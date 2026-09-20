"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CaretUpDown, PencilSimple, ArrowsLeftRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, Meeting, Member, ProgressStatus, Rating } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookCover from "@/components/BookCover";
import BookSearch from "@/components/BookSearch";
import StatusPicker, { STATUS_LABEL } from "@/components/StatusPicker";
import { Kicker, Num, OutlineButton, PillButton, Score, Sheet } from "@/components/ui";
import { markCompleted } from "@/lib/books";
import { spineColor } from "@/lib/design";
import { cn } from "@/lib/utils";

/** Ledger order: done first (by score), then in progress, not started, gave up. */
const GROUP: Record<ProgressStatus, number> = { finished: 0, reading: 1, none: 2, dnf: 3 };

interface LedgerRow {
  member: Member;
  status: ProgressStatus;
  score: number | null;
  scored: boolean;
  isMe: boolean;
}

export default function ReadingScreen() {
  const { currentMember, members } = useMember();
  const [book, setBook] = useState<Book | null>(null);
  const [upNext, setUpNext] = useState<Book[]>([]);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [pickingStatus, setPickingStatus] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: books } = await supabase.from("books").select("*");
    const all = (books || []) as Book[];
    const reading = all.find((b) => b.status === "reading") ?? null;

    setBook(reading);
    setUpNext(all.filter((b) => b.status === "upcoming"));

    if (reading) {
      const [{ data: prog }, { data: rats }] = await Promise.all([
        supabase.from("book_progress").select("member_id, status").eq("book_id", reading.id),
        supabase.from("ratings").select("*").eq("book_id", reading.id),
      ]);
      const map: Record<string, ProgressStatus> = {};
      for (const p of prog || []) map[p.member_id] = p.status;
      setProgress(map);
      setRatings(rats || []);
      setRevealed(localStorage.getItem(`reveal-${reading.id}`) === "true");
    } else {
      setProgress({});
      setRatings([]);
    }

    const today = new Date().toISOString().split("T")[0];
    const { data: meetings } = await supabase
      .from("meetings")
      .select("*")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(1);

    const next = meetings?.[0] ?? null;
    setMeeting(next);
    if (next) {
      const { count } = await supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("meeting_id", next.id)
        .eq("status", "going");
      setGoingCount(count || 0);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Coming back to this tab after changing the book elsewhere should show it.
  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const rows = useMemo<LedgerRow[]>(() => {
    const scoreFor = (memberId: string) => {
      const r = ratings.find((x) => x.member_id === memberId);
      return r ? r.post_rating ?? r.pre_rating : null;
    };
    return members
      .map((member) => {
        const status = progress[member.id] ?? "none";
        const score = scoreFor(member.id);
        return {
          member,
          status,
          score,
          scored: score !== null && status !== "none",
          isMe: member.id === currentMember?.id,
        };
      })
      .sort((a, b) => GROUP[a.status] - GROUP[b.status] || (b.score ?? -1) - (a.score ?? -1));
  }, [members, progress, ratings, currentMember]);

  function toggleReveal() {
    if (!book) return;
    const next = !revealed;
    setRevealed(next);
    localStorage.setItem(`reveal-${book.id}`, String(next));
  }

  async function setStatus(status: ProgressStatus) {
    if (!currentMember || !book) return;
    setProgress((p) => ({ ...p, [currentMember.id]: status }));
    await supabase.from("book_progress").upsert(
      {
        book_id: book.id,
        member_id: currentMember.id,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
  }

  async function startReading(bookId: string) {
    if (book) await markCompleted(book.id);
    await supabase.from("books").update({ status: "reading" }).eq("id", bookId);
    setSwapping(false);
    setLoading(true);
    await load();
  }

  const myStatus = currentMember ? progress[currentMember.id] ?? "none" : "none";
  const othersScored = rows.filter((r) => r.scored && !r.isMe).length;

  if (loading) return <div className="h-[300px] animate-pulse bg-tan/40" />;

  return (
    <div>
      {book ? (
        <div className="relative">
          <Link href={`/book/${book.id}`} className="relative block h-[300px] overflow-hidden">
            <BookCover book={book} className="h-full w-full" fit="cover" eager />
            {/* Heavier than the original scrim: the title has to hold against
                a busy cover, so the lower half resolves to solid ground. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg,rgba(255,245,231,0) 0%,rgba(255,245,231,.14) 26%,rgba(255,245,231,.62) 52%,rgba(255,245,231,.93) 74%,#fff5e7 88%)",
              }}
            />
            <div className="absolute inset-x-5 bottom-4">
              <Kicker tone="green">Reading now</Kicker>
              <h1 className="mt-[6px] text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-ink">
                {book.title}
              </h1>
              <p className="mt-2 text-[13.5px] text-muted">
                {book.author}
                {book.page_count ? (
                  <>
                    {" · "}
                    <Num>{book.page_count}</Num> pp
                  </>
                ) : null}
              </p>
            </div>
          </Link>

          {currentMember && (
            <button
              onClick={() => setSwapping(true)}
              aria-label="Change the current book"
              className="absolute right-5 top-[66px] flex items-center gap-[6px] rounded-full border border-green bg-ground/85 px-3 py-[6px] text-[11px] font-medium text-ink backdrop-blur-sm active:bg-green/10"
            >
              <ArrowsLeftRight size={13} />
              Change
            </button>
          )}
        </div>
      ) : (
        <div className="px-5 pt-[62px]">
          <Kicker tone="green">Reading now</Kicker>
          <p className="mt-[6px] text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-ink">
            Nothing on
            <br />
            the go
          </p>
          {currentMember && (
            <OutlineButton className="mt-5" onClick={() => setSwapping(true)}>
              Pick the book
            </OutlineButton>
          )}
        </div>
      )}

      {book && (
        <section className="px-5 pt-[18px]">
          <div className="flex items-center justify-between">
            <Kicker>Where everyone is</Kicker>
            {othersScored > 0 && (
              <PillButton onClick={toggleReveal}>{revealed ? "Hide" : "Reveal scores"}</PillButton>
            )}
          </div>

          <div className="mt-3">
            {rows.length === 0 && <p className="py-3 text-[13px] text-muted">No members yet.</p>}
            {rows.map(({ member, status, score, scored, isMe }) => (
              <div key={member.id} className="row-line flex items-center gap-3 py-[11px]">
                <span
                  className={cn(
                    "w-[2px] self-stretch rounded-sm",
                    scored ? "bg-green" : status === "reading" ? "bg-teal" : "bg-transparent"
                  )}
                />
                <span
                  className={cn(
                    "text-[14.5px]",
                    status === "none" || status === "dnf" ? "text-muted" : "text-ink",
                    status === "dnf" && "line-through"
                  )}
                >
                  {member.name}
                  {isMe && " (you)"}
                </span>
                <span className="flex-1" />

                {isMe ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPickingStatus(true)}
                      className="flex items-center gap-[6px] rounded-lg border border-tan px-[10px] py-[5px] text-[11.5px] text-ink active:bg-tan/40"
                    >
                      {STATUS_LABEL[status]}
                      <CaretUpDown size={12} className="text-green" />
                    </button>
                    {scored && (
                      <Link
                        href={`/book/${book.id}`}
                        className="flex items-center gap-[4px] active:opacity-70"
                      >
                        <Score value={score} />
                        <PencilSimple size={12} className="text-green" />
                      </Link>
                    )}
                  </div>
                ) : scored ? (
                  <Score value={score} blurred={!revealed} />
                ) : (
                  <span className="text-[11.5px] text-muted">{STATUS_LABEL[status]}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {meeting && (
        <section className="flex items-end justify-between gap-4 px-5 pt-6">
          <div>
            <Kicker>
              {new Date(meeting.date + "T00:00:00").toLocaleDateString("en-US", {
                weekday: "long",
                day: "numeric",
                month: "short",
              })}
            </Kicker>
            <p className="mt-[6px] text-[18px] text-ink">
              {formatClock(meeting.time)}
              {meeting.location ? ` · ${meeting.location}` : ""}
            </p>
            <p className="mt-1 text-[12.5px] text-muted">
              {meeting.notes ? `${meeting.notes} · ` : ""}
              <Num>{goingCount}</Num> going
            </p>
          </div>
          <Link
            href="/calendar"
            className="whitespace-nowrap rounded-lg border border-green px-4 py-[9px] text-[13px] font-medium text-ink"
          >
            RSVP
          </Link>
        </section>
      )}

      {pickingStatus && currentMember && book && (
        <StatusPicker current={myStatus} onPick={setStatus} onClose={() => setPickingStatus(false)} />
      )}

      {swapping && currentMember && (
        <Sheet title="What are we reading?" onClose={() => setSwapping(false)}>
          {upNext.length > 0 ? (
            upNext.map((b) => (
              <button
                key={b.id}
                onClick={() => startReading(b.id)}
                className="row-line flex w-full items-center gap-3 py-[11px] text-left"
              >
                <div
                  className="h-[46px] w-[31px] flex-none overflow-hidden rounded-sm"
                  style={{ background: spineColor(b.title) }}
                >
                  <BookCover book={b} className="h-full w-full" fit="cover" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{b.title}</span>
                  <span className="block truncate text-[12px] text-muted">{b.author}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="py-4 text-[13px] text-muted">Nothing lined up yet.</p>
          )}
          <OutlineButton
            className="mt-4 w-full"
            onClick={() => {
              setSwapping(false);
              setSearching(true);
            }}
          >
            Find a book
          </OutlineButton>
        </Sheet>
      )}

      {searching && currentMember && (
        <BookSearch
          memberId={currentMember.id}
          onBookAdded={async (added) => {
            setSearching(false);
            await startReading(added.id);
          }}
          onClose={() => setSearching(false)}
        />
      )}
    </div>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
