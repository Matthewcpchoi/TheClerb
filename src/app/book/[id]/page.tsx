"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Book, BookComment, Rating, DiscussionTopic } from "@/types";
import { useMember } from "@/components/MemberProvider";
import RatingSlider from "@/components/RatingSlider";
import ClubRatings from "@/components/ClubRatings";
import DiscussionTopics from "@/components/DiscussionTopics";
import BookCover from "@/components/BookCover";
import { markCompleted } from "@/lib/books";
import { getExactPageCount } from "@/lib/utils";
import {
  Avatar,
  Button,
  Card,
  ScoreBadge,
  SectionTitle,
  StatusPill,
  textareaClass,
} from "@/components/ui";

type RatingMode = "idle" | "rate" | "change";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { currentMember } = useMember();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [mode, setMode] = useState<RatingMode>("idle");
  const [commentDraft, setCommentDraft] = useState("");
  const [editingComment, setEditingComment] = useState(false);
  const [savingComment, setSavingComment] = useState(false);

  const fetchBook = useCallback(async () => {
    const { data } = await supabase.from("books").select("*").eq("id", bookId).maybeSingle();
    if (data) setBook(data);
  }, [bookId]);

  const fetchRatings = useCallback(async () => {
    const { data } = await supabase
      .from("ratings")
      .select("*, member:members(*)")
      .eq("book_id", bookId);
    if (data) setRatings(data);
  }, [bookId]);

  const fetchComments = useCallback(async () => {
    const { data, error } = await supabase
      .from("book_comments")
      .select("*, member:members(*)")
      .eq("book_id", bookId)
      .order("updated_at", { ascending: false });
    // The table may not exist until the migration is run; treat that as empty.
    if (!error && data) setComments(data);
  }, [bookId]);

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from("discussion_topics")
      .select("*, member:members(*)")
      .eq("book_id", bookId)
      .order("created_at", { ascending: true });
    if (data) setTopics(data);
  }, [bookId]);

  useEffect(() => {
    fetchBook();
    fetchRatings();
    fetchComments();
    fetchTopics();
  }, [fetchBook, fetchRatings, fetchComments, fetchTopics]);

  useEffect(() => {
    const channel = supabase
      .channel(`book-${bookId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `book_id=eq.${bookId}` },
        () => fetchRatings()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "book_comments", filter: `book_id=eq.${bookId}` },
        () => fetchComments()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, fetchRatings, fetchComments]);

  const myRating = currentMember ? ratings.find((r) => r.member_id === currentMember.id) ?? null : null;
  const myScore = myRating ? (myRating.post_rating ?? myRating.pre_rating) : null;
  const myComment = currentMember ? comments.find((c) => c.member_id === currentMember.id) ?? null : null;

  useEffect(() => {
    if (myComment && !editingComment) setCommentDraft(myComment.content);
  }, [myComment, editingComment]);

  // A quote from the club, sampled per visit, in place of a publisher blurb.
  const sampledComment = useMemo(() => {
    if (comments.length === 0) return null;
    return comments[Math.floor(Math.random() * comments.length)];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length, bookId]);

  const clubScore = useMemo(() => {
    const vals = ratings
      .filter((r) => r.is_visible)
      .map((r) => r.post_rating ?? r.pre_rating)
      .filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }, [ratings]);

  /* ------------------------------------------------------------ actions */

  async function handleFirstRating(value: number) {
    if (!currentMember) return;
    await supabase
      .from("ratings")
      .upsert(
        { book_id: bookId, member_id: currentMember.id, pre_rating: value, is_visible: false },
        { onConflict: "book_id,member_id" }
      );
    setMode("idle");
    fetchRatings();
  }

  /**
   * "Change rating": same slider, pre-filled with the current score. Saving
   * an unchanged value is a no-op. A changed value is stored as post_rating so
   * the original is kept for the "went in at / left at" history.
   */
  async function handleChangeRating(value: number, note?: string) {
    if (!myRating || myScore === null) return;
    if (Math.abs(value - myScore) < 0.05) {
      setMode("idle");
      return;
    }
    await supabase
      .from("ratings")
      .update({
        post_rating: value,
        rating_change_reason: note ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", myRating.id);
    setMode("idle");
    fetchRatings();
  }

  async function handleToggleVisibility() {
    if (!myRating) return;
    await supabase.from("ratings").update({ is_visible: !myRating.is_visible }).eq("id", myRating.id);
    fetchRatings();
  }

  async function handleSaveComment() {
    if (!currentMember || !commentDraft.trim()) return;
    setSavingComment(true);
    const { error } = await supabase.from("book_comments").upsert(
      {
        book_id: bookId,
        member_id: currentMember.id,
        content: commentDraft.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
    setSavingComment(false);
    if (error) {
      console.error("[supabase] save comment:", error.message);
      return;
    }
    setEditingComment(false);
    fetchComments();
  }

  async function handleAddTopic(content: string) {
    if (!currentMember) return;
    await supabase
      .from("discussion_topics")
      .insert({ book_id: bookId, member_id: currentMember.id, content, is_spoiler: true });
    fetchTopics();
  }

  async function handleStatusChange(next: Book["status"]) {
    if (next === "reading") {
      const { data: others } = await supabase
        .from("books")
        .select("id")
        .eq("status", "reading")
        .neq("id", bookId);
      for (const o of others || []) await markCompleted(o.id);
    }
    if (next === "completed") await markCompleted(bookId);
    else await supabase.from("books").update({ status: next }).eq("id", bookId);
    fetchBook();
  }

  async function handleRemove() {
    if (!book || !confirm(`Remove "${book.title}" from the shelf?`)) return;
    await supabase.from("books").delete().eq("id", bookId);
    router.push("/shelf");
  }

  /* ------------------------------------------------------------- render */

  if (!book) {
    return (
      <div className="max-w-4xl mx-auto animate-pulse">
        <div className="h-4 w-24 bg-charcoal/5 rounded mb-8" />
        <div className="flex gap-8">
          <div className="w-40 aspect-[2/3] bg-charcoal/5 rounded-lg" />
          <div className="flex-1 space-y-3 pt-2">
            <div className="h-8 w-2/3 bg-charcoal/5 rounded" />
            <div className="h-4 w-1/3 bg-charcoal/5 rounded" />
          </div>
        </div>
      </div>
    );
  }

  const pages = getExactPageCount(book);

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/shelf"
        className="inline-flex items-center gap-1.5 font-sans text-sm text-warm-brown hover:text-mahogany transition-colors mb-6"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        The Shelf
      </Link>

      {/* Header */}
      <div className="flex gap-6 sm:gap-10 mb-10">
        <div className="relative flex-shrink-0">
          <BookCover
            book={book}
            className="w-32 sm:w-48 aspect-[2/3] rounded-xl shadow-[0_4px_8px_rgba(43,38,34,0.15),0_24px_48px_-16px_rgba(43,38,34,0.5)]"
            eager
          />
          {clubScore !== null && (
            <ScoreBadge score={clubScore} size="lg" className="absolute -bottom-3 -right-3" />
          )}
        </div>

        <div className="min-w-0 flex-1 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusPill status={book.status} />
            {book.completed_at && (
              <span className="font-sans text-xs text-warm-brown/70">
                Read{" "}
                {new Date(book.completed_at).toLocaleDateString("en-US", {
                  month: "long",
                  year: "numeric",
                })}
              </span>
            )}
          </div>

          <h1 className="font-serif text-3xl sm:text-[40px] text-charcoal leading-[1.08] tracking-tight mt-3">
            {book.title}
          </h1>
          {book.author && (
            <p className="font-sans text-base sm:text-lg text-warm-brown mt-2">{book.author}</p>
          )}
          {pages && (
            <p className="font-sans text-xs text-warm-brown/60 mt-1.5">{pages.toLocaleString()} pages</p>
          )}

          {sampledComment && (
            <figure className="mt-5 pl-4 border-l-2 border-gold/60">
              <blockquote className="font-serif text-[15px] sm:text-base text-charcoal/85 leading-relaxed italic line-clamp-4">
                &ldquo;{sampledComment.content}&rdquo;
              </blockquote>
              <figcaption className="flex items-center gap-1.5 mt-2">
                <Avatar name={sampledComment.member?.name ?? "?"} size="xs" />
                <span className="font-sans text-xs text-warm-brown">
                  {sampledComment.member?.name ?? "A member"}
                </span>
              </figcaption>
            </figure>
          )}

          {currentMember && (
            <div className="mt-auto pt-5 flex items-center gap-2 flex-wrap">
              <select
                value={book.status}
                onChange={(e) => handleStatusChange(e.target.value as Book["status"])}
                className="h-9 pl-3 pr-8 rounded-lg border border-charcoal/10 bg-white font-sans text-sm text-charcoal focus:outline-none focus:border-gold"
              >
                <option value="upcoming">Up next</option>
                <option value="reading">Reading now</option>
                <option value="completed">Finished</option>
              </select>
              <Button variant="ghost" size="sm" onClick={handleRemove} className="text-red-700/70">
                Remove
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left column: your rating + your take */}
        <div className="lg:col-span-2 space-y-6">
          {currentMember && (
            <Card>
              <SectionTitle>Your rating</SectionTitle>

              {mode === "rate" && (
                <RatingSlider
                  label="Rate this book"
                  onSubmit={(v) => handleFirstRating(v)}
                  onCancel={() => setMode("idle")}
                  submitLabel="Save rating"
                />
              )}

              {mode === "change" && myScore !== null && (
                <RatingSlider
                  label="Change your rating"
                  initialValue={myScore}
                  onSubmit={handleChangeRating}
                  onCancel={() => setMode("idle")}
                  submitLabel="Save new rating"
                  cancelLabel="Keep my rating"
                  withNote
                />
              )}

              {mode === "idle" && myScore === null && (
                <div>
                  <p className="font-sans text-sm text-charcoal/70 mb-4">
                    Rate it privately. Reveal whenever you like — usually at the meeting.
                  </p>
                  <Button className="w-full" onClick={() => setMode("rate")}>
                    Rate this book
                  </Button>
                </div>
              )}

              {mode === "idle" && myScore !== null && myRating && (
                <div>
                  <div className="flex items-center gap-4">
                    <ScoreBadge score={myScore} size="xl" />
                    <div className="min-w-0">
                      <p className="font-sans text-sm text-charcoal font-medium">
                        {myRating.is_visible ? "Revealed to the club" : "Private — only you"}
                      </p>
                      {myRating.post_rating !== null && (
                        <p className="font-sans text-xs text-warm-brown/70 mt-0.5">
                          Revised from {myRating.pre_rating?.toFixed(1)}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-5">
                    <Button variant="secondary" onClick={() => setMode("change")}>
                      Change rating
                    </Button>
                    <Button
                      variant={myRating.is_visible ? "secondary" : "gold"}
                      onClick={handleToggleVisibility}
                    >
                      {myRating.is_visible ? "Hide" : "Reveal"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}

          {currentMember && (
            <Card>
              <SectionTitle
                action={
                  myComment && !editingComment ? (
                    <Button size="sm" variant="ghost" onClick={() => setEditingComment(true)}>
                      Edit
                    </Button>
                  ) : undefined
                }
              >
                Your take
              </SectionTitle>

              {myComment && !editingComment ? (
                <p className="font-serif text-[15px] text-charcoal leading-relaxed">
                  &ldquo;{myComment.content}&rdquo;
                </p>
              ) : (
                <div className="space-y-3">
                  <textarea
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    placeholder="A line or two for the club. Shown next to your rating."
                    className={textareaClass}
                    rows={4}
                  />
                  <div className="flex gap-2">
                    {myComment && (
                      <Button
                        variant="secondary"
                        className="flex-1"
                        onClick={() => {
                          setEditingComment(false);
                          setCommentDraft(myComment.content);
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                    <Button
                      className="flex-1"
                      onClick={handleSaveComment}
                      disabled={savingComment || !commentDraft.trim()}
                    >
                      {savingComment ? "Saving…" : myComment ? "Save" : "Post"}
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Right column: the club */}
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <SectionTitle>The club</SectionTitle>
            <ClubRatings
              ratings={ratings}
              comments={comments}
              currentMemberId={currentMember?.id ?? null}
            />
          </Card>

          <Card>
            <SectionTitle>For the meeting</SectionTitle>
            <DiscussionTopics
              topics={topics}
              bookId={bookId}
              memberId={currentMember?.id ?? null}
              onAddTopic={handleAddTopic}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
