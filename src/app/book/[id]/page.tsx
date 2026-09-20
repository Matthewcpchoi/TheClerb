"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { CaretLeft } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, BookComment, BookQuote, DiscussionTopic, Member, ProgressStatus, Rating } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookCover from "@/components/BookCover";
import ScoreSlider from "@/components/ScoreSlider";
import DiscussionTopics from "@/components/DiscussionTopics";
import Quotes from "@/components/Quotes";
import { STATUS_LABEL } from "@/components/StatusPicker";
import { DeleteButton, Kicker, Num, OutlineButton, PillButton, Rule, Score, SolidButton } from "@/components/ui";
import { leather, shortMonthYear } from "@/lib/design";
import { cn } from "@/lib/utils";

const GROUP: Record<ProgressStatus, number> = { finished: 0, reading: 1, none: 2, dnf: 3 };
type View = "yours" | "club";

export default function BookScreen() {
  return (
    <Suspense fallback={<div className="px-5 pt-[62px]"><div className="h-6 w-1/2 animate-pulse rounded bg-tan/50" /></div>}>
      <BookScreenInner />
    </Suspense>
  );
}

function BookScreenInner() {
  const { id } = useParams();
  const bookId = id as string;
  const router = useRouter();
  const params = useSearchParams();
  const { currentMember, members } = useMember();

  // Arriving from the shelf you want to read the club; from Reading you want
  // to write your own. The toggle switches between the two.
  const [view, setView] = useState<View>(params.get("view") === "club" ? "club" : "yours");

  const [book, setBook] = useState<Book | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [quotes, setQuotes] = useState<BookQuote[]>([]);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingReview, setEditingReview] = useState(false);
  const [savingScore, setSavingScore] = useState(false);

  const load = useCallback(async () => {
    const [{ data: b }, { data: r }, commentsRes, quotesRes, { data: t }, { data: p }] =
      await Promise.all([
        supabase.from("books").select("*").eq("id", bookId).maybeSingle(),
        supabase.from("ratings").select("*").eq("book_id", bookId),
        supabase.from("book_comments").select("*, member:members(*)").eq("book_id", bookId),
        supabase
          .from("book_quotes")
          .select("*, member:members(*)")
          .eq("book_id", bookId)
          .order("created_at"),
        supabase
          .from("discussion_topics")
          .select("*, member:members(*)")
          .eq("book_id", bookId)
          .order("created_at"),
        supabase.from("book_progress").select("member_id, status").eq("book_id", bookId),
      ]);

    setBook(b ?? null);
    setRatings(r || []);
    setComments(commentsRes.error ? [] : (commentsRes.data as BookComment[]) || []);
    setQuotes(quotesRes.error ? [] : (quotesRes.data as BookQuote[]) || []);
    setTopics(t || []);
    const map: Record<string, ProgressStatus> = {};
    for (const row of p || []) map[row.member_id] = row.status;
    setProgress(map);
    setRevealed(localStorage.getItem(`reveal-${bookId}`) === "true");
  }, [bookId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`book-${bookId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ratings", filter: `book_id=eq.${bookId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [bookId, load]);

  const myRating = currentMember ? ratings.find((r) => r.member_id === currentMember.id) : undefined;
  const myScore = myRating ? myRating.post_rating ?? myRating.pre_rating : null;
  const myReview = currentMember ? comments.find((c) => c.member_id === currentMember.id) : undefined;

  useEffect(() => {
    if (myReview && !editingReview) setDraft(myReview.content);
  }, [myReview, editingReview]);

  async function saveScore(v: number) {
    if (!currentMember) return;
    setSavingScore(true);
    await supabase.from("ratings").upsert(
      {
        book_id: bookId,
        member_id: currentMember.id,
        pre_rating: myRating?.pre_rating ?? v,
        post_rating: myRating?.pre_rating != null && myRating.pre_rating !== v ? v : null,
        is_visible: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
    setSavingScore(false);
    load();
  }

  async function saveReview() {
    if (!currentMember || !draft.trim()) return;
    await supabase.from("book_comments").upsert(
      {
        book_id: bookId,
        member_id: currentMember.id,
        content: draft.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
    setEditingReview(false);
    load();
  }

  async function addQuote(content: string, page: string) {
    if (!currentMember) return;
    await supabase
      .from("book_quotes")
      .insert({ book_id: bookId, member_id: currentMember.id, content, page: page || null });
    load();
  }

  async function addTopic(content: string, page: string) {
    if (!currentMember) return;
    const row: Record<string, unknown> = {
      book_id: bookId,
      member_id: currentMember.id,
      content,
      is_spoiler: true,
      page: page || null,
    };
    let { error } = await supabase.from("discussion_topics").insert(row);
    if (error && error.message.includes("page")) {
      delete row.page;
      ({ error } = await supabase.from("discussion_topics").insert(row));
    }
    load();
  }

  if (!book) {
    return (
      <div className="px-5 pt-[62px]">
        <div className="h-6 w-1/2 animate-pulse rounded bg-tan/50" />
      </div>
    );
  }

  const ledger = members
    .map((m: Member) => {
      const r = ratings.find((x) => x.member_id === m.id);
      const score = r ? r.post_rating ?? r.pre_rating : null;
      const status = progress[m.id] ?? "none";
      return {
        member: m,
        score,
        status,
        scored: score !== null && status !== "none",
        review: comments.find((c) => c.member_id === m.id),
      };
    })
    .sort((a, b) => GROUP[a.status] - GROUP[b.status] || (b.score ?? -1) - (a.score ?? -1));

  const othersScored = ledger.filter((l) => l.scored && l.member.id !== currentMember?.id).length;
  const myQuotes = quotes.filter((q) => q.member_id === currentMember?.id);
  const myTopics = topics.filter((t) => t.member_id === currentMember?.id);

  return (
    <div className="pb-6">
      <div
        className="sticky top-0 z-10 flex items-center px-5 pb-3 pt-[56px] backdrop-blur-md"
        style={{ background: "rgba(255,245,231,.92)" }}
      >
        <button
          onClick={() => router.back()}
          className="flex items-center gap-[6px] text-[13px] text-green"
        >
          <CaretLeft size={16} />
          Back
        </button>
      </div>

      <div className="flex gap-4 px-5 pt-1">
        <div
          className="cover-lift h-[129px] w-[86px] flex-none overflow-hidden rounded-sm"
          style={{ background: book.spine_color || leather(book.title).hex }}
        >
          <BookCover book={book} className="h-full w-full" fit="cover" eager />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-medium leading-[1.1] tracking-[-0.02em] text-ink">
            {book.title}
          </h1>
          <p className="mt-[6px] text-[13px] text-muted">
            {book.author}
            {book.page_count ? (
              <>
                {" · "}
                <Num>{book.page_count}</Num> pp
              </>
            ) : null}
          </p>
          {book.completed_at && (
            <p className="mt-1 text-[12px] text-muted">Read {shortMonthYear(book.completed_at)}</p>
          )}
          {currentMember?.is_admin && (
            <button
              onClick={async () => {
                if (!confirm(`Remove "${book.title}" from the shelf?`)) return;
                await supabase.from("books").delete().eq("id", bookId);
                router.push("/shelf");
              }}
              className="mt-2 text-[11.5px] text-muted/70"
            >
              Remove from the shelf
            </button>
          )}
        </div>
      </div>

      {/* Writing and reading are different jobs; this decides which you're doing. */}
      <div className="px-5 pt-6">
        <div className="relative flex rounded-lg border border-tan p-[3px]">
          <span
            className="absolute inset-y-[3px] w-[calc(50%-3px)] rounded-[6px] bg-green transition-transform duration-200"
            style={{ transform: view === "club" ? "translateX(100%)" : "translateX(0)" }}
          />
          {(["yours", "club"] as View[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "relative z-10 flex-1 py-[7px] text-[12.5px] font-medium transition-colors",
                view === v ? "text-ground" : "text-muted"
              )}
            >
              {v === "yours" ? "Yours" : "The Club"}
            </button>
          ))}
        </div>
      </div>

      {view === "yours" ? (
        <>
          {currentMember ? (
            <>
              <section className="px-5 pt-6">
                <Kicker>Your Score</Kicker>
                <div className="mt-3">
                  <ScoreSlider value={myScore} onSave={saveScore} saving={savingScore} />
                </div>
              </section>

              <div className="mt-7">
                <Rule />
              </div>

              <section className="px-5 pt-5">
                <div className="flex items-baseline justify-between">
                  <Kicker>Your NYT Review</Kicker>
                  <div className="flex items-center gap-3">
                    {myReview && !editingReview && (
                      <button
                        onClick={() => setEditingReview(true)}
                        className="text-[11.5px] text-green"
                      >
                        Edit
                      </button>
                    )}
                    {myReview && (
                      <DeleteButton
                        label="Delete your review"
                        onDelete={async () => {
                          await supabase.from("book_comments").delete().eq("id", myReview.id);
                          setDraft("");
                          setEditingReview(false);
                          load();
                        }}
                      />
                    )}
                  </div>
                </div>

                {myReview && !editingReview ? (
                  <p className="mt-3 border-l-2 border-green pl-[14px] text-[14px] italic leading-[1.55] text-ink">
                    {myReview.content}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      placeholder="Your unfiltered back of cover review"
                      className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[14px] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-green"
                    />
                    <div className="flex gap-2">
                      {myReview && (
                        <OutlineButton className="flex-1" onClick={() => setEditingReview(false)}>
                          Cancel
                        </OutlineButton>
                      )}
                      <SolidButton className="flex-1" onClick={saveReview} disabled={!draft.trim()}>
                        {myReview ? "Save" : "Post"}
                      </SolidButton>
                    </div>
                  </div>
                )}
              </section>

              <div className="mt-7">
                <Rule />
              </div>

              <section className="px-5 pt-5">
                <Quotes
                  quotes={myQuotes}
                  memberId={currentMember.id}
                  onAdd={addQuote}
                  onDelete={async (qid) => {
                    await supabase.from("book_quotes").delete().eq("id", qid);
                    load();
                  }}
                />
              </section>

              <div className="mt-7">
                <Rule />
              </div>

              <section className="px-5 pt-5">
                <DiscussionTopics
                  topics={myTopics}
                  bookId={bookId}
                  memberId={currentMember.id}
                  onAddTopic={addTopic}
                  onDelete={async (tid) => {
                    await supabase.from("discussion_topics").delete().eq("id", tid);
                    load();
                  }}
                />
              </section>
            </>
          ) : (
            <p className="px-5 pt-6 text-[13px] text-muted">Pick who you are first.</p>
          )}
        </>
      ) : (
        <>
          <section className="px-5 pt-6">
            <div className="flex items-center justify-between">
              <Kicker>The Reviews</Kicker>
              {othersScored > 0 && (
                <PillButton
                  onClick={() => {
                    const next = !revealed;
                    setRevealed(next);
                    localStorage.setItem(`reveal-${bookId}`, String(next));
                  }}
                >
                  {revealed ? "Hide" : "Reveal Scores"}
                </PillButton>
              )}
            </div>
            <div className="mt-3">
              {ledger.map((l, i) => {
                const isMe = l.member.id === currentMember?.id;
                return (
                  <div
                    key={l.member.id}
                    className={cn("py-[12px]", i < ledger.length - 1 && "row-line")}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "w-[2px] self-stretch rounded-sm",
                          l.scored ? "bg-green" : l.status === "reading" ? "bg-teal" : "bg-transparent"
                        )}
                      />
                      <span
                        className={cn(
                          "text-[14.5px]",
                          l.status === "none" || l.status === "dnf" ? "text-muted" : "text-ink",
                          l.status === "dnf" && "line-through"
                        )}
                      >
                        {l.member.name}
                        {isMe && " (you)"}
                      </span>
                      <span className="flex-1" />
                      {l.scored ? (
                        <Score value={l.score} blurred={!isMe && !revealed} />
                      ) : (
                        <span className="text-[11.5px] text-muted">{STATUS_LABEL[l.status]}</span>
                      )}
                    </div>
                    {l.review && (
                      <p className="mt-[7px] pl-[14px] text-[13px] italic leading-relaxed text-muted">
                        &ldquo;{l.review.content}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-7">
            <Rule />
          </div>

          <section className="px-5 pt-5">
            <Quotes quotes={quotes} memberId={null} onAdd={() => {}} onDelete={() => {}} />
          </section>

          <div className="mt-7">
            <Rule />
          </div>

          <section className="px-5 pt-5">
            <DiscussionTopics topics={topics} bookId={bookId} memberId={null} readOnly />
          </section>
        </>
      )}
    </div>
  );
}
