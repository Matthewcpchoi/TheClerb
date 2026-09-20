"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CaretRight, CaretUpDown, PencilSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Attendance, Book, Meeting, Member, ProgressStatus, Rating } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookCover from "@/components/BookCover";
import StatusPicker, { STATUS_LABEL } from "@/components/StatusPicker";
import SectionRail from "@/components/SectionRail";
import { Kicker, Num, OutlineButton, PillButton, Score } from "@/components/ui";
import { cn } from "@/lib/utils";

/** Ledger order: done first (by score), then in progress, not started, gave up. */
const GROUP: Record<ProgressStatus, number> = { finished: 0, reading: 1, none: 2, dnf: 3 };

type Rsvp = "going" | "maybe" | "not_going";
const RSVP_OPTIONS: { key: Rsvp; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "not_going", label: "Can't" },
];

export default function ReadingScreen() {
  const { currentMember, members } = useMember();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [pickingStatus, setPickingStatus] = useState(false);
  const [loading, setLoading] = useState(true);

  /**
   * What the club is reading is whatever the next meeting is about. It is not
   * a per-person setting, and it holds until that meeting's date has passed —
   * changing it means moving the meeting, on the Meet tab.
   */
  const load = useCallback(async () => {
    const today = new Date().toISOString().split("T")[0];
    const { data: meetings } = await supabase
      .from("meetings")
      .select("*, book:books(*)")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(1);

    const next = (meetings?.[0] as Meeting & { book?: Book }) ?? null;
    setMeeting(next);
    const current = next?.book ?? null;
    setBook(current);

    if (current) {
      const [{ data: prog }, { data: rats }] = await Promise.all([
        supabase.from("book_progress").select("member_id, status").eq("book_id", current.id),
        supabase.from("ratings").select("*").eq("book_id", current.id),
      ]);
      const map: Record<string, ProgressStatus> = {};
      for (const p of prog || []) map[p.member_id] = p.status;
      setProgress(map);
      setRatings(rats || []);
      setRevealed(localStorage.getItem(`reveal-${current.id}`) === "true");
    } else {
      setProgress({});
      setRatings([]);
    }

    if (next) {
      const { data: att } = await supabase
        .from("attendance")
        .select("*, member:members(*)")
        .eq("meeting_id", next.id);
      setAttendance(att || []);
    } else {
      setAttendance([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const refresh = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [load]);

  const rows = useMemo(() => {
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

  async function setStatus(status: ProgressStatus) {
    if (!currentMember || !book) return;
    setProgress((p) => ({ ...p, [currentMember.id]: status }));
    await supabase.from("book_progress").upsert(
      { book_id: book.id, member_id: currentMember.id, status, updated_at: new Date().toISOString() },
      { onConflict: "book_id,member_id" }
    );
  }

  async function rsvp(status: Rsvp) {
    if (!currentMember || !meeting) return;
    setAttendance((prev) => [
      ...prev.filter((a) => a.member_id !== currentMember.id),
      {
        id: `tmp`,
        meeting_id: meeting.id,
        member_id: currentMember.id,
        status,
        member: currentMember,
      },
    ]);
    await supabase
      .from("attendance")
      .upsert(
        { meeting_id: meeting.id, member_id: currentMember.id, status },
        { onConflict: "meeting_id,member_id" }
      );
    load();
  }

  const myStatus = currentMember ? progress[currentMember.id] ?? "none" : "none";
  const othersScored = rows.filter((r) => r.scored && !r.isMe).length;
  const myRsvp = attendance.find((a) => a.member_id === currentMember?.id)?.status;
  const going = attendance.filter((a) => a.status === "going");
  const maybe = attendance.filter((a) => a.status === "maybe");
  const cant = attendance.filter((a) => a.status === "not_going");
  const answered = new Set(attendance.map((a) => a.member_id));
  const silent = members.filter((m: Member) => !answered.has(m.id));

  if (loading) return <div className="h-[300px] animate-pulse bg-tan/40" />;

  return (
    <div className="pb-10">
      {book ? (
        <>
          <Link
            id="the-book"
            href={`/book/${book.id}`}
            className="relative block h-[300px] overflow-hidden"
          >
            <BookCover book={book} className="h-full w-full" fit="cover" eager />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg,rgba(255,245,231,0) 0%,rgba(255,245,231,.14) 26%,rgba(255,245,231,.62) 52%,rgba(255,245,231,.93) 74%,#fff5e7 88%)",
              }}
            />
            <div className="absolute inset-x-5 bottom-4">
              <Kicker tone="green">Reading Now</Kicker>
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

          {/* Saying what the cover leads to, rather than leaving it to be found. */}
          <Link
            href={`/book/${book.id}`}
            className="mx-5 flex items-center gap-3 rounded-lg border border-green/40 bg-green/[0.06] px-4 py-3 active:bg-green/10"
          >
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium text-ink">Score It, Add Lines &amp; Questions</p>
              <p className="mt-[2px] text-[11.5px] text-muted">Your page for this book</p>
            </div>
            <CaretRight size={16} className="flex-none text-green" />
          </Link>
        </>
      ) : (
        <div className="px-5 pt-[62px]">
          <Kicker tone="green">Reading Now</Kicker>
          <p className="mt-[6px] text-[30px] font-medium leading-[1.08] tracking-[-0.025em] text-ink">
            {meeting ? "No book on the\nnext meeting" : "No meeting\nscheduled"}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            The club reads whatever the next meeting is about.
          </p>
          <Link
            href="/calendar"
            className="mt-5 inline-block rounded-lg border border-green px-4 py-[9px] text-[13px] font-medium text-ink"
          >
            {meeting ? "Set the Book" : "Schedule a Meeting"}
          </Link>
        </div>
      )}

      {book && (
        <section id="club-progress" className="scroll-mt-4 px-5 pt-6">
          <div className="flex items-center justify-between">
            <Kicker>Club Progress</Kicker>
            {othersScored > 0 && (
              <PillButton onClick={() => {
                const next = !revealed;
                setRevealed(next);
                localStorage.setItem(`reveal-${book.id}`, String(next));
              }}>
                {revealed ? "Hide" : "Reveal Scores"}
              </PillButton>
            )}
          </div>

          <div className="mt-3">
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
                      <Link href={`/book/${book.id}`} className="flex items-center gap-[4px]">
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

      {/* The meeting, as its own card rather than a loose paragraph. */}
      {meeting && (
        <section id="next-meeting" className="scroll-mt-4 px-5 pt-7">
          <Kicker>Next Meeting</Kicker>
          <div className="mt-2 rounded-xl border border-tan p-4">
            <div className="flex items-center gap-3">
              <div className="w-[46px] flex-none text-center">
                <p className="kicker text-green">
                  {new Date(`${meeting.date}T00:00:00`).toLocaleDateString("en-US", {
                    month: "short",
                  })}
                </p>
                <Num className="mt-[2px] block text-[30px] font-semibold leading-none text-ink">
                  {new Date(`${meeting.date}T00:00:00`).getDate()}
                </Num>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] text-ink">
                  {new Date(`${meeting.date}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "long",
                  })}
                  , {formatClock(meeting.time)}
                </p>
                {(meeting.location || meeting.notes) && (
                  <p className="mt-[2px] truncate text-[12.5px] text-muted">
                    {[meeting.location, meeting.notes].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>

            {currentMember && (
              <div className="mt-3 flex gap-2">
                {RSVP_OPTIONS.map((o) => (
                  <OutlineButton
                    key={o.key}
                    selected={myRsvp === o.key}
                    onClick={() => rsvp(o.key)}
                    className="flex-1 px-0 py-[9px] text-center"
                  >
                    {o.label}
                  </OutlineButton>
                ))}
              </div>
            )}

            <div className="mt-3 space-y-[6px]">
              {(
                [
                  ["Going", going.map((a) => a.member?.name)],
                  ["Maybe", maybe.map((a) => a.member?.name)],
                  ["Can't", cant.map((a) => a.member?.name)],
                  ["No Answer", silent.map((m) => m.name)],
                ] as const
              ).map(([label, names]) =>
                names.length ? (
                  <div key={label} className="flex gap-3 text-[12.5px]">
                    <span className="w-[72px] flex-none text-muted">{label}</span>
                    <span className="min-w-0 flex-1 text-ink">
                      {names.filter(Boolean).join(", ")}
                    </span>
                  </div>
                ) : null
              )}
            </div>
          </div>
        </section>
      )}

      {book && (
        <SectionRail
          sections={[
            { id: "the-book", label: "Book" },
            { id: "club-progress", label: "Progress" },
            ...(meeting ? [{ id: "next-meeting", label: "Meeting" }] : []),
          ]}
        />
      )}

      {pickingStatus && currentMember && book && (
        <StatusPicker current={myStatus} onPick={setStatus} onClose={() => setPickingStatus(false)} />
      )}
    </div>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
