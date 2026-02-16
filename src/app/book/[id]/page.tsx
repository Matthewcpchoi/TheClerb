"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Book, Rating, DiscussionTopic } from "@/types";
import { useMember } from "@/components/MemberProvider";
import RatingSlider from "@/components/RatingSlider";
import RatingReveal from "@/components/RatingReveal";
import DiscussionTopics from "@/components/DiscussionTopics";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchVolumeById } from "@/lib/google-books";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { currentMember } = useMember();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [editingPre, setEditingPre] = useState(false);
  const [showPostRating, setShowPostRating] = useState(false);
  const [editingPost, setEditingPost] = useState(false);
  const [postReason, setPostReason] = useState("");
  const [pendingPostValue, setPendingPostValue] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [coverSrc, setCoverSrc] = useState("");

  const fetchBook = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();
    if (data) {
      setBook(data);
      if (typeof data.page_count === "number") setPageCount(data.page_count);
      setCoverSrc(data.cover_url || data.thumbnail_url || "");
      if (data.google_books_id) {
        try {
          const json = await fetchVolumeById(data.google_books_id);
          if (!json) return;
          if (json.volumeInfo?.description) {
            setDescription(json.volumeInfo.description);
          }
          if (json.volumeInfo?.pageCount) {
            setPageCount(json.volumeInfo.pageCount);
            // Backfill page_count in DB if missing
            if (!data.page_count) {
              supabase
                .from("books")
                .update({ page_count: json.volumeInfo.pageCount })
                .eq("id", bookId)
                .then();
            }
          }
        } catch {
          // Ignore
        }
      }
    }
  }, [bookId]);

  const fetchRatings = useCallback(async () => {
    const { data } = await supabase
      .from("ratings")
      .select("*, member:members(*)")
      .eq("book_id", bookId);
    if (data) {
      setRatings(data);
      if (currentMember) {
        const mine = data.find((r) => r.member_id === currentMember.id);
        if (mine) setMyRating(mine);
      }
    }
  }, [bookId, currentMember]);

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
    fetchTopics();
  }, [fetchBook, fetchRatings, fetchTopics]);

  useEffect(() => {
    const channel = supabase
      .channel(`ratings-${bookId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ratings",
          filter: `book_id=eq.${bookId}`,
        },
        () => {
          fetchRatings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, fetchRatings]);

  async function handlePreRating(value: number) {
    if (!currentMember) return;

    const { data } = await supabase
      .from("ratings")
      .upsert(
        {
          book_id: bookId,
          member_id: currentMember.id,
          pre_rating: value,
          is_visible: false,
        },
        { onConflict: "book_id,member_id" }
      )
      .select("*, member:members(*)")
      .single();

    if (data) {
      setMyRating(data);
      setEditingPre(false);
      fetchRatings();
    }
  }

  async function handlePostRating(value: number) {
    if (!currentMember || !myRating) return;

    const preVal = myRating.pre_rating ?? 5;
    const changed = Math.abs(value - preVal) > 0.001;

    if (changed && !pendingPostValue) {
      // Score changed from pre — ask for reason before saving
      setPendingPostValue(value);
      return;
    }

    const reason = changed ? postReason || null : null;

    await supabase
      .from("ratings")
      .update({
        post_rating: pendingPostValue ?? value,
        rating_change_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq("id", myRating.id);

    setShowPostRating(false);
    setEditingPost(false);
    setPostReason("");
    setPendingPostValue(null);
    fetchRatings();
  }

  async function handleToggleVisibility(ratingId: string, isVisible: boolean) {
    await supabase
      .from("ratings")
      .update({ is_visible: isVisible })
      .eq("id", ratingId);
    fetchRatings();
  }

  async function handleAddTopic(content: string) {
    if (!currentMember) return;
    await supabase.from("discussion_topics").insert({
      book_id: bookId,
      member_id: currentMember.id,
      content,
      is_spoiler: true,
    });
    fetchTopics();
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-serif text-xl text-warm-brown/40 animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  const hasPreRating = myRating && myRating.pre_rating !== null;
  const hasPostRating = myRating && myRating.post_rating !== null;

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/shelf"
        className="inline-flex items-center gap-1 font-sans text-sm text-warm-brown hover:text-mahogany transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Shelf
      </Link>

      {/* Book Header */}
      <div className="flex flex-col md:flex-row items-start gap-8 mb-10">
        <div className="flex-shrink-0 relative">
          {coverSrc && (
            <img
              src={coverSrc}
              alt={book.title}
              className="w-48 h-72 object-cover rounded-lg shadow-xl"
              referrerPolicy="no-referrer"
              onError={() => {
                if (coverSrc !== (book.thumbnail_url || "")) {
                  setCoverSrc(book.thumbnail_url || "");
                } else {
                  setCoverSrc("");
                }
              }}
            />
          )}
          {/* Club Score Badge */}
          {(() => {
            const visibleRatings = ratings.filter((r) => r.is_visible);
            const vals = visibleRatings
              .map((r) => r.post_rating ?? r.pre_rating)
              .filter((v): v is number => v !== null);
            if (vals.length === 0) return null;
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            return (
              <div className="absolute -bottom-3 -right-3 bg-gold text-cream rounded-full w-14 h-14 flex flex-col items-center justify-center shadow-lg border-2 border-cream">
                <span className="font-serif text-lg font-bold leading-none">{avg.toFixed(1)}</span>
                <span className="font-sans text-[8px] uppercase tracking-wider leading-none mt-0.5">Club</span>
              </div>
            );
          })()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-sans ${
                book.status === "reading"
                  ? "bg-sage/20 text-sage"
                  : book.status === "completed"
                    ? "bg-gold/20 text-gold"
                    : "bg-cream-dark text-warm-brown/60"
              }`}
            >
              {book.status === "reading"
                ? "Currently Reading"
                : book.status === "completed"
                  ? "Completed"
                  : "Upcoming"}
            </span>
            {currentMember && (
              <select
                value={book.status}
                onChange={async (e) => {
                  const nextStatus = e.target.value as Book["status"];
                  if (nextStatus === "reading") {
                    await supabase
                      .from("books")
                      .update({ status: "completed" })
                      .eq("status", "reading")
                      .neq("id", bookId);
                  }
                  await supabase
                    .from("books")
                    .update({ status: nextStatus })
                    .eq("id", bookId);
                  fetchBook();
                }}
                className="px-3 py-1 rounded text-xs font-sans border border-cream-dark bg-white text-charcoal focus:outline-none"
              >
                <option value="reading">Currently Reading</option>
                <option value="completed">Completed</option>
              </select>
            )}
            {currentMember && (
              <button
                onClick={async () => {
                  if (!confirm(`Remove "${book.title}" from the shelf?`)) return;
                  await supabase.from("ratings").delete().eq("book_id", bookId);
                  await supabase.from("discussion_topics").delete().eq("book_id", bookId);
                  await supabase.from("books").delete().eq("id", bookId);
                  router.push("/shelf");
                }}
                className="px-3 py-1 rounded text-xs font-sans border border-red-300 text-red-400 hover:bg-red-50 hover:text-red-600 transition-colors"
              >
                Remove
              </button>
            )}
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-charcoal mb-2">
            {book.title}
          </h1>
          {book.author && (
            <p className="font-sans text-lg text-warm-brown mb-2">
              {book.author}
            </p>
          )}
          <div className="flex items-center gap-4 text-sm font-sans text-warm-brown/60 mb-4">
            {pageCount && (
              <span>{pageCount} pages</span>
            )}
            {book.completed_at && (
              <span>Read {new Date(book.completed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</span>
            )}
          </div>
          {description && (
            <div
              className="font-sans text-sm text-charcoal/70 leading-relaxed line-clamp-6"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>
      </div>

      {/* Ratings Section */}
      <div className="bg-white/50 rounded-xl border border-cream-dark p-6 mb-6">
        <h2 className="font-serif text-xl text-charcoal mb-6">Ratings</h2>

        {/* No rating yet — show pre-club slider */}
        {currentMember && !hasPreRating && (
          <div className="mb-6 p-4 rounded-lg bg-cream-dark/30">
            <RatingSlider
              label="Your Pre-Club Rating"
              onSubmit={handlePreRating}
            />
          </div>
        )}

        {/* Has pre-rating — show value with edit */}
        {currentMember && hasPreRating && !editingPre && (
          <div className="mb-6 p-3 rounded-lg bg-cream-dark/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-sans text-xs text-warm-brown/60">
                  Your Pre-Club Rating
                </p>
                <p className="font-serif text-xl text-mahogany font-bold">
                  {myRating!.pre_rating?.toFixed(1)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditingPre(true)}
                  className="p-1.5 rounded-lg hover:bg-cream-dark/60 transition-colors text-warm-brown/50 hover:text-warm-brown"
                  title="Edit rating"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() =>
                    handleToggleVisibility(myRating!.id, !myRating!.is_visible)
                  }
                  className={`px-3 py-1.5 rounded text-xs font-sans transition-colors ${
                    myRating!.is_visible
                      ? "bg-sage/20 text-sage"
                      : "bg-gold/20 text-gold"
                  }`}
                >
                  {myRating!.is_visible
                    ? "Rating Visible (click to hide)"
                    : "Make Rating Visible"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editing pre-rating */}
        {currentMember && editingPre && (
          <div className="mb-6 p-4 rounded-lg bg-cream-dark/30">
            <RatingSlider
              label="Edit Pre-Club Rating"
              initialValue={myRating?.pre_rating ?? 5}
              onSubmit={handlePreRating}
              submitLabel="Save Rating"
            />
            <button
              onClick={() => setEditingPre(false)}
              className="w-full mt-2 py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Post-club: "Post-Club Rating" button (only after book completed, has pre, no post yet) */}
        {currentMember && hasPreRating && !hasPostRating && !editingPre && book.status === "completed" && (
          <>
            {!showPostRating ? (
              <button
                onClick={() => setShowPostRating(true)}
                className="w-full mb-6 py-2.5 rounded-lg border border-gold text-gold font-sans text-sm hover:bg-gold/10 transition-colors"
              >
                Post-Club Rating
              </button>
            ) : (
              <div className="mb-6 p-4 rounded-lg bg-cream-dark/30 space-y-4">
                {!pendingPostValue ? (
                  <RatingSlider
                    label="Your Post-Club Rating"
                    initialValue={myRating!.pre_rating ?? 5}
                    onSubmit={handlePostRating}
                    submitLabel="Submit"
                  />
                ) : (
                  <>
                    <div className="text-center">
                      <p className="font-sans text-sm text-warm-brown mb-1">Your new score</p>
                      <p className="font-serif text-2xl text-gold font-bold">{pendingPostValue.toFixed(1)}</p>
                      <p className="font-sans text-xs text-warm-brown/60 mt-1">
                        Changed from {myRating!.pre_rating?.toFixed(1)}
                      </p>
                    </div>
                    <textarea
                      value={postReason}
                      onChange={(e) => setPostReason(e.target.value)}
                      placeholder="What changed your mind?"
                      className="w-full px-4 py-2 rounded-lg border border-cream-dark bg-white font-sans text-sm text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                      rows={2}
                      autoFocus
                    />
                    <button
                      onClick={() => handlePostRating(pendingPostValue)}
                      className="w-full py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
                    >
                      Save
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setShowPostRating(false);
                    setPendingPostValue(null);
                    setPostReason("");
                  }}
                  className="w-full py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark/30 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}

        {/* Has both pre and post — show both with edit */}
        {currentMember && hasPostRating && !editingPost && (
          <div className="mb-6 p-3 rounded-lg bg-cream-dark/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <div>
                  <p className="font-sans text-xs text-warm-brown/60">Pre</p>
                  <p className="font-serif text-xl text-mahogany font-bold">
                    {myRating!.pre_rating?.toFixed(1)}
                  </p>
                </div>
                <div>
                  <p className="font-sans text-xs text-warm-brown/60">Post</p>
                  <p className="font-serif text-xl text-gold font-bold">
                    {myRating!.post_rating?.toFixed(1)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingPost(true)}
                className="p-1.5 rounded-lg hover:bg-cream-dark/60 transition-colors text-warm-brown/50 hover:text-warm-brown"
                title="Edit post rating"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            </div>
            {myRating!.rating_change_reason && (
              <p className="font-sans text-sm text-charcoal/70 mt-2 italic">
                &ldquo;{myRating!.rating_change_reason}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* Editing post-rating */}
        {currentMember && editingPost && (
          <div className="mb-6 p-4 rounded-lg bg-cream-dark/30 space-y-4">
            {!pendingPostValue ? (
              <RatingSlider
                label="Edit Post-Club Rating"
                initialValue={myRating?.post_rating ?? myRating?.pre_rating ?? 5}
                onSubmit={handlePostRating}
                submitLabel="Save Rating"
              />
            ) : (
              <>
                <div className="text-center">
                  <p className="font-sans text-sm text-warm-brown mb-1">Your new score</p>
                  <p className="font-serif text-2xl text-gold font-bold">{pendingPostValue.toFixed(1)}</p>
                </div>
                <textarea
                  value={postReason}
                  onChange={(e) => setPostReason(e.target.value)}
                  placeholder="What changed your mind?"
                  className="w-full px-4 py-2 rounded-lg border border-cream-dark bg-white font-sans text-sm text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                  rows={2}
                  autoFocus
                />
                <button
                  onClick={() => handlePostRating(pendingPostValue)}
                  className="w-full py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
                >
                  Save
                </button>
              </>
            )}
            <button
              onClick={() => {
                setEditingPost(false);
                setPendingPostValue(null);
                setPostReason("");
              }}
              className="w-full py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {/* All Ratings */}
        <RatingReveal
          ratings={ratings}
          currentMemberId={currentMember?.id || null}
          onToggleVisibility={handleToggleVisibility}
        />
      </div>

      {/* Discussion Topics */}
      <div className="bg-white/50 rounded-xl border border-cream-dark p-6">
        <DiscussionTopics
          topics={topics}
          bookId={bookId}
          memberId={currentMember?.id || null}
          onAddTopic={handleAddTopic}
        />
      </div>
    </div>
  );
}
