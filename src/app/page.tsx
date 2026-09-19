"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Book, Meeting, Member, ProgressStatus, Rating } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookCover from "@/components/BookCover";
import { CaretUpDown, PencilSimple } from "@phosphor-icons/react";
import { Kicker, Num, PillButton } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Ledger order: finished first (by score), then reading, not started, DNF. */
const GROUP: Record<ProgressStatus, number> = { finished: 0, reading: 1, none: 2, dnf: 3 };
const CYCLE: ProgressStatus[] = ["none", "reading", "finished", "dnf"];

const STATUS_LABEL: Record<Exclude<ProgressStatus, "finished">, string> = {
  reading: "In progress",
  none: "Not started",
  dnf: "Gave up",
};

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
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data: reading } = await supabase
      .from("books")
      .select("*")
      .eq("status", "reading")
      .limit(1)
      .maybeSingle();

    setBook(reading ?? null);

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

  const rows = useMemo<LedgerRow[]>(() => {
    const scoreFor = (memberId: string) => {
      const r = ratings.find((x) => x.member_id === memberId);
      if (!r) return null;
      return r.post_rating ?? r.pre_rating;
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
      .sort(
        (a, b) =>
          GROUP[a.status] - GROUP[b.status] || (b.score ?? -1) - (a.score ?? -1)
      );
  }, [members, progress, ratings, currentMember]);

  function toggleReveal() {
    if (!book) return;
    const next = !revealed;
    setRevealed(next);
    localStorage.setItem(`reveal-${book.id}`, String(next));
  }

  /** Tapping your own name moves you along: none → reading → finished → DNF. */
  async function cycleOwnStatus() {
    if (!currentMember || !book) return;
    const current = progress[currentMember.id] ?? "none";
    const next = CYCLE[(CYCLE.indexOf(current) + 1) % CYCLE.length];
    setProgress((p) => ({ ...p, [currentMember.id]: next }));
    await supabase.from("book_progress").upsert(
      {
        book_id: book.id,
        member_id: currentMember.id,
        status: next,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "book_id,member_id" }
    );
  }

  if (loading) {
    return (
      <div className="h-[300px] animate-pulse bg-tan/40" />
    );
  }

  if (!book) {
    return (
      <div className="px-5 pt-[62px]">
        <Kicker tone="green" wide>
          Reading now
        </Kicker>
        <p className="mt-3 text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-ink">
          Nothing on
          <br />
          the go
        </p>
        <p className="mt-3 text-[13.5px] text-muted">
          Pick the next one from the shelf.
        </p>
        <Link
          href="/shelf"
          className="mt-5 inline-block rounded-lg border border-green px-4 py-[9px] text-[13px] font-medium text-ink"
        >
          Go to the shelf
        </Link>
      </div>
    );
  }

  const revealCount = rows.filter((r) => r.scored && !r.isMe).length;

  return (
    <div>
      {/* Cover header, full bleed under the status bar */}
      <Link href={`/book/${book.id}`} className="relative block h-[300px] overflow-hidden">
        <BookCover book={book} className="h-full w-full" fit="cover" eager />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg,rgba(255,245,231,.06) 0%,rgba(255,245,231,0) 30%,rgba(255,245,231,.82) 78%,#fff5e7 100%)",
          }}
        />
        <div className="absolute inset-x-5 bottom-4">
          <Kicker tone="green" wide>
            Reading now
          </Kicker>
          <h1 className="mt-2 text-[34px] font-medium leading-[1.05] tracking-[-0.025em] text-ink">
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

      {/* The ledger */}
      <section className="px-5 pt-[18px]">
        <div className="flex items-center justify-between">
          <Kicker>Where everyone is</Kicker>
          {revealCount > 0 && (
            <PillButton onClick={toggleReveal}>
              {revealed ? "Hide" : "Reveal scores"}
            </PillButton>
          )}
        </div>

        <div className="mt-3">
          {rows.length === 0 && (
            <p className="py-3 text-[13px] text-muted">No members yet.</p>
          )}
          {rows.map((row) => {
            const { member, status, score, scored, isMe } = row;
            const mark =
              scored ? "bg-green" : status === "reading" ? "bg-teal" : "bg-transparent";
            return (
              <div key={member.id} className="row-line flex items-center gap-3 py-[11px]">
                <span className={cn("w-[2px] self-stretch rounded-sm", mark)} />
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

                {scored ? (
                  // Your own score is a way in to change it; everyone else's
                  // stays blurred until the club reveals.
                  isMe ? (
                    <Link
                      href={`/book/${book.id}`}
                      className="flex items-center gap-[5px] text-ink active:opacity-70"
                    >
                      <Num className="text-[17px] font-semibold">{score!.toFixed(1)}</Num>
                      <PencilSimple size={13} className="text-green" />
                    </Link>
                  ) : (
                    <Num
                      className={cn(
                        "text-[17px] font-semibold text-ink",
                        revealed ? "score-reveal" : "score-blur"
                      )}
                    >
                      {score!.toFixed(1)}
                    </Num>
                  )
                ) : isMe ? (
                  // The control is the value itself: a picker you tap to move
                  // yourself along, rather than a label with a hint beside it.
                  <button
                    onClick={cycleOwnStatus}
                    className="flex items-center gap-[6px] rounded-lg border border-tan px-[10px] py-[5px] text-[11px] uppercase tracking-[0.1em] text-ink transition-colors active:bg-tan/40"
                    aria-label={`Your status: ${STATUS_LABEL[status as Exclude<ProgressStatus, "finished">]}. Tap to change.`}
                  >
                    {STATUS_LABEL[status as Exclude<ProgressStatus, "finished">]}
                    <CaretUpDown size={13} className="text-green" />
                  </button>
                ) : (
                  <span className="text-[11px] uppercase tracking-[0.1em] text-muted">
                    {STATUS_LABEL[status as Exclude<ProgressStatus, "finished">]}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Next meeting */}
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
    </div>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  return `${hour % 12 || 12}:${m} ${ampm}`;
}
