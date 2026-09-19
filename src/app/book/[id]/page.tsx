"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CaretLeft } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, BookComment, DiscussionTopic, Member, ProgressStatus, Rating } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookCover from "@/components/BookCover";
import ScoreTicks from "@/components/ScoreTicks";
import DiscussionTopics from "@/components/DiscussionTopics";
import { Kicker, Num, OutlineButton, PillButton, Rule, SolidButton } from "@/components/ui";
import { markCompleted } from "@/lib/books";
import { shortMonthYear } from "@/lib/design";
import { cn } from "@/lib/utils";

const GROUP: Record<ProgressStatus, number> = { finished: 0, reading: 1, none: 2, dnf: 3 };

export default function BookScreen() {
  const { id } = useParams();
  const bookId = id as string;
  const router = useRouter();
  const { currentMember, members } = useMember();

  const [book, setBook] = useState<Book | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [revealed, setRevealed] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingTake, setEditingTake] = useState(false);

  const load = useCallback(async () => {
    const [{ data: b }, { data: r }, commentsRes, { data: t }, { data: p }] = await Promise.all([
      supabase.from("books").select("*").eq("id", bookId).maybeSingle(),
      supabase.from("ratings").select("*").eq("book_id", bookId),
      supabase.from("book_comments").select("*, member:members(*)").eq("book_id", bookId),
      supabase
        .from("discussion_topics")
        .select("*, member:members(*)")
        .eq("book_id", bookId)
        .order("created_at"),
      supabase.from("book_progress").select("member_id, status").eq("book_id", bookId),
    ]);

    setBook(b ?? null);
    setRatings(r || []);
    // book_comments may not exist until its migration runs.
    setComments(commentsRes.error ? [] : (commentsRes.data as BookComment[]) || []);
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
  const myComment = currentMember ? comments.find((c) => c.member_id === currentMember.id) : undefined;

  useEffect(() => {
    if (myComment && !editingTake) setDraft(myComment.content);
  }, [myComment, editingTake]);

  async function saveScore(v: number) {
    if (!currentMember) return;
    setRatings((prev) => {
      const others = prev.filter((r) => r.member_id !== currentMember.id);
      const existing = prev.find((r) => r.member_id === currentMember.id);
      return [
        ...others,
        {
          ...(existing ?? {
            id: `tmp`,
            book_id: bookId,
            member_id: currentMember.id,
            post_rating: null,
            rating_change_reason: null,
            is_visible: false,
            created_at: "",
            updated_at: "",
          }),
          pre_rating: existing?.post_rating != null ? existing.pre_rating : v,
          post_rating: existing?.post_rating != null ? v : null,
        } as Rating,
      ];
    });
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
    load();
  }

  async function saveTake() {
    if (!currentMember || !draft.trim()) return;
    const { error } = await supabase.from("book_comments").upsert(
      {
        book_id: bookId,
        member_id: currentMember.id,
        content: draft.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
    if (error) {
      console.error("[supabase] save take:", error.message);
      return;
    }
    setEditingTake(false);
    load();
  }

  async function addTopic(content: string) {
    if (!currentMember) return;
    await supabase
      .from("discussion_topics")
      .insert({ book_id: bookId, member_id: currentMember.id, content, is_spoiler: true });
    load();
  }

  function toggleReveal() {
    const next = !revealed;
    setRevealed(next);
    localStorage.setItem(`reveal-${bookId}`, String(next));
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
      return { member: m, score, status, scored: score !== null && status !== "none" };
    })
    .sort((a, b) => GROUP[a.status] - GROUP[b.status] || (b.score ?? -1) - (a.score ?? -1));

  const scoredOthers = ledger.filter((l) => l.scored && l.member.id !== currentMember?.id).length;

  return (
    <div className="pb-6">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-5 pb-3 pt-[56px] backdrop-blur-md"
        style={{ background: "rgba(255,245,231,.92)" }}>
        <button
          onClick={() => router.back()}
          className="flex items-center gap-[6px] text-[13px] text-green"
        >
          <CaretLeft size={16} />
          Back
        </button>
      </div>

      <div className="flex gap-4 px-5 pt-1">
        <Link href={`/book/${book.id}`} className="flex-none">
          <BookCover
            book={book}
            className="cover-lift w-[86px]"
            style={{ aspectRatio: "2/3", borderRadius: "2px 5px 5px 2px" }}
            eager
          />
        </Link>
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
            <p className="mt-1 text-[12px] text-muted">
              Read {shortMonthYear(book.completed_at)}
            </p>
          )}
          {currentMember && (
            <div className="mt-3 flex flex-wrap gap-2">
              {book.status !== "reading" && (
                <OutlineButton
                  className="px-3 py-[6px] text-[12px]"
                  onClick={async () => {
                    await supabase
                      .from("books")
                      .update({ status: "completed" })
                      .eq("status", "reading");
                    await supabase.from("books").update({ status: "reading" }).eq("id", bookId);
                    load();
                  }}
                >
                  Start reading
                </OutlineButton>
              )}
              {book.status !== "completed" && (
                <OutlineButton
                  className="px-3 py-[6px] text-[12px]"
                  onClick={async () => {
                    await markCompleted(bookId);
                    load();
                  }}
                >
                  Mark finished
                </OutlineButton>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Score entry */}
      {currentMember && (
        <section className="px-5 pt-6">
          <ScoreTicks value={myScore} onChange={saveScore} />
          <p className="mt-[10px] text-[11.5px] text-muted">
            Blurred for everyone else until the club reveals.
          </p>
        </section>
      )}

      <div className="mt-6">
        <Rule />
      </div>

      {/* Your take */}
      {currentMember && (
        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <Kicker>Your take</Kicker>
            {myComment && !editingTake && (
              <button onClick={() => setEditingTake(true)} className="text-[11px] text-green">
                Edit
              </button>
            )}
          </div>
          {myComment && !editingTake ? (
            <p className="mt-3 border-l-2 border-green pl-[14px] text-[13.5px] italic leading-[1.55] text-ink">
              {myComment.content}
            </p>
          ) : (
            <div className="mt-3 space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                placeholder="A line or two for the club."
                className="w-full resize-none rounded-lg border border-tan bg-transparent px-3 py-2 text-[13.5px] leading-relaxed text-ink outline-none placeholder:text-muted/60 focus:border-green"
              />
              <div className="flex gap-2">
                {myComment && (
                  <OutlineButton className="flex-1" onClick={() => setEditingTake(false)}>
                    Cancel
                  </OutlineButton>
                )}
                <SolidButton className="flex-1" onClick={saveTake} disabled={!draft.trim()}>
                  {myComment ? "Save" : "Post"}
                </SolidButton>
              </div>
            </div>
          )}
        </section>
      )}

      <div className="mt-6">
        <Rule />
      </div>

      {/* The club's scores */}
      <section className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <Kicker>What everyone gave it</Kicker>
          {scoredOthers > 0 && (
            <PillButton onClick={toggleReveal}>{revealed ? "Hide" : "Reveal scores"}</PillButton>
          )}
        </div>
        <div className="mt-3">
          {ledger.map((l) => {
            const isMe = l.member.id === currentMember?.id;
            const c = comments.find((x) => x.member_id === l.member.id);
            return (
              <div key={l.member.id} className="row-line py-[11px]">
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
                    <Num
                      className={cn(
                        "text-[17px] font-semibold text-ink",
                        !isMe && (revealed ? "score-reveal" : "score-blur")
                      )}
                    >
                      {l.score!.toFixed(1)}
                    </Num>
                  ) : (
                    <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
                      {l.status === "reading"
                        ? "In progress"
                        : l.status === "dnf"
                          ? "Gave up"
                          : "Not started"}
                    </span>
                  )}
                </div>
                {c && (
                  <p className="mt-[6px] pl-[14px] text-[12.5px] italic leading-relaxed text-muted">
                    &ldquo;{c.content}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-6">
        <Rule />
      </div>

      <section className="px-5 pt-5">
        <DiscussionTopics
          topics={topics}
          bookId={bookId}
          memberId={currentMember?.id ?? null}
          onAddTopic={addTopic}
        />
      </section>
    </div>
  );
}
