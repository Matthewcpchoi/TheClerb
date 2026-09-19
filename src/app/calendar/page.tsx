"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Attendance, Book, Meeting } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { Kicker, Num, OutlineButton, Rule, ScreenTitle, SolidButton } from "@/components/ui";
import { cn } from "@/lib/utils";

type Rsvp = "going" | "maybe" | "not_going";
const RSVP_OPTIONS: { key: Rsvp; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "not_going", label: "Can't" },
];

const EMPTY = { title: "", date: "", time: "", location: "", notes: "", book_id: "" };

export default function MeetScreen() {
  const { currentMember, members } = useMember();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: b }] = await Promise.all([
      supabase.from("meetings").select("*, book:books(*)").order("date").order("time"),
      supabase.from("attendance").select("*, member:members(*)"),
      supabase.from("books").select("*").order("created_at", { ascending: false }),
    ]);
    setMeetings(m || []);
    const grouped: Record<string, Attendance[]> = {};
    for (const row of a || []) (grouped[row.meeting_id] ||= []).push(row);
    setAttendance(grouped);
    setBooks(b || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel("attendance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(`${m.date}T${m.time}`) >= now);
  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1);

  const myRsvp = next
    ? (attendance[next.id] || []).find((a) => a.member_id === currentMember?.id)?.status
    : undefined;

  /** "You + 3 going · Ines can't · Sam hasn't said" */
  const summary = useMemo(() => {
    if (!next) return "";
    const rows = attendance[next.id] || [];
    const going = rows.filter((r) => r.status === "going");
    const cant = rows.filter((r) => r.status === "not_going");
    const answeredIds = new Set(rows.map((r) => r.member_id));
    const silent = members.filter((m) => !answeredIds.has(m.id));

    const parts: string[] = [];
    const meGoing = going.some((g) => g.member_id === currentMember?.id);
    const others = going.length - (meGoing ? 1 : 0);
    if (meGoing) parts.push(others > 0 ? `You + ${others} going` : "You're going");
    else if (going.length) parts.push(`${going.length} going`);

    if (cant.length)
      parts.push(`${cant.map((c) => c.member?.name).filter(Boolean).join(", ")} can't`);
    if (silent.length)
      parts.push(
        silent.length === 1
          ? `${silent[0].name} hasn't said`
          : `${silent.length} haven't said`
      );
    return parts.join(" · ");
  }, [next, attendance, members, currentMember]);

  async function handleRsvp(status: Rsvp) {
    if (!currentMember || !next) return;
    setAttendance((prev) => {
      const list = (prev[next.id] || []).filter((a) => a.member_id !== currentMember.id);
      return {
        ...prev,
        [next.id]: [
          ...list,
          {
            id: `tmp-${next.id}`,
            meeting_id: next.id,
            member_id: currentMember.id,
            status,
            member: currentMember,
          },
        ],
      };
    });
    await supabase
      .from("attendance")
      .upsert(
        { meeting_id: next.id, member_id: currentMember.id, status },
        { onConflict: "meeting_id,member_id" }
      );
    load();
  }

  async function handleSave() {
    if (!form.title || !form.date || !form.time) return;
    await supabase.from("meetings").insert({
      title: form.title,
      date: form.date,
      time: form.time,
      location: form.location || null,
      notes: form.notes || null,
      book_id: form.book_id || null,
    });
    setForm(EMPTY);
    setShowForm(false);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("meetings").delete().eq("id", id);
    load();
  }

  const d = next ? new Date(`${next.date}T00:00:00`) : null;

  return (
    <div className="px-5 pt-[62px]">
      <div className="flex items-baseline justify-between">
        <ScreenTitle>Meetings</ScreenTitle>
        {currentMember && (
          <button
            onClick={() => setShowForm((s) => !s)}
            className="text-[11.5px] font-medium text-green"
          >
            {showForm ? "Cancel" : "Propose a date"}
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-4 space-y-2 rounded-lg border border-tan p-3">
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="What's the meeting?"
            className="w-full border-b border-tan-soft bg-transparent py-2 text-[14.5px] text-ink outline-none placeholder:text-muted/60"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="num flex-1 border-b border-tan-soft bg-transparent py-2 text-[13px] text-ink outline-none"
            />
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm({ ...form, time: e.target.value })}
              className="num flex-1 border-b border-tan-soft bg-transparent py-2 text-[13px] text-ink outline-none"
            />
          </div>
          <input
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="Where?"
            className="w-full border-b border-tan-soft bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-muted/60"
          />
          <input
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="How far are we reading?"
            className="w-full border-b border-tan-soft bg-transparent py-2 text-[13px] text-ink outline-none placeholder:text-muted/60"
          />
          <select
            value={form.book_id}
            onChange={(e) => setForm({ ...form, book_id: e.target.value })}
            className="control w-full rounded-lg border border-tan bg-transparent py-[7px] pl-[11px] pr-[30px] text-[12px] text-ink outline-none"
          >
            <option value="">No book</option>
            {books.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <SolidButton className="w-full" onClick={handleSave}>
            Add it
          </SolidButton>
        </div>
      )}

      {loading ? (
        <div className="mt-6 h-20 animate-pulse rounded bg-tan/40" />
      ) : !next ? (
        <p className="mt-6 text-[13px] leading-relaxed text-muted">
          Nothing on the calendar. Propose a date and everyone can say if they&apos;re in.
        </p>
      ) : (
        <div className="mt-6">
          <Kicker tone="green">Next up</Kicker>
          <div className="mt-[10px] flex items-baseline gap-3">
            <Num className="text-[40px] font-semibold leading-none text-ink">
              {d!.getDate()}
            </Num>
            <div>
              <p className="text-[17px] text-ink">
                {d!.toLocaleDateString("en-US", { weekday: "long" })}, {formatClock(next.time)}
              </p>
              <p className="mt-[3px] text-[12.5px] text-muted">
                {[next.location, next.notes].filter(Boolean).join(" · ") || next.title}
              </p>
            </div>
          </div>

          {currentMember && (
            <div className="mt-[18px] flex gap-2">
              {RSVP_OPTIONS.map((o) => (
                <OutlineButton
                  key={o.key}
                  selected={myRsvp === o.key}
                  onClick={() => handleRsvp(o.key)}
                  className="flex-1 px-0 py-[10px] text-center"
                >
                  {o.label}
                </OutlineButton>
              ))}
            </div>
          )}

          {summary && <p className="mt-[10px] text-[11.5px] text-muted">{summary}</p>}
        </div>
      )}

      <div className="-mx-5 mt-[26px]">
        <Rule />
      </div>

      <section className="mt-5">
        <Kicker>Penciled in</Kicker>
        {later.length === 0 ? (
          <p className="py-4 text-[12.5px] text-muted">Nothing further out yet.</p>
        ) : (
          later.map((m, i) => {
            const md = new Date(`${m.date}T00:00:00`);
            return (
              <div
                key={m.id}
                className={cn(
                  "flex items-baseline gap-[14px] py-[14px]",
                  i < later.length - 1 && "row-line"
                )}
              >
                <Num className="w-[34px] text-[17px] font-semibold text-muted">
                  {md.getDate()}
                </Num>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] text-ink">
                    {md.toLocaleDateString("en-US", { month: "short" })} · {m.title}
                  </p>
                  <p className="mt-[2px] text-[12px] text-muted">
                    {[m.location, m.notes].filter(Boolean).join(" · ") || "No details yet"}
                  </p>
                </div>
                {currentMember && (
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-[11px] text-muted/70"
                    aria-label={`Delete ${m.title}`}
                  >
                    Remove
                  </button>
                )}
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
