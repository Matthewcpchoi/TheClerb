"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Attendance, Book, Meeting, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { Kicker, Num, OutlineButton, Rule, ScreenTitle, SolidButton } from "@/components/ui";
import { cn } from "@/lib/utils";

type Rsvp = "going" | "maybe" | "not_going";
const RSVP_OPTIONS: { key: Rsvp; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "not_going", label: "Can't" },
];

/** host_id is absent on rows created before migration 005; reads guard for it. */
type MeetingRow = Meeting;

const EMPTY = { book_id: "", host_id: "", location: "", date: "", time: "19:30", notes: "" };

const field =
  "w-full rounded-lg border border-tan bg-transparent px-3 py-[10px] text-[14px] text-ink outline-none placeholder:text-muted/60 focus:border-green";

export default function MeetScreen() {
  const { currentMember, members } = useMember();
  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: b }] = await Promise.all([
      supabase.from("meetings").select("*").order("date").order("time"),
      supabase.from("attendance").select("*, member:members(*)"),
      supabase.from("books").select("*").order("created_at", { ascending: false }),
    ]);
    setMeetings((m || []) as MeetingRow[]);
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
    const ch = supabase
      .channel("attendance-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [load]);

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(`${m.date}T${m.time}`) >= now);
  const past = meetings.filter((m) => new Date(`${m.date}T${m.time}`) < now).reverse();
  const next = upcoming[0] ?? null;
  const later = upcoming.slice(1);

  const bookById = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);
  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const reading = books.find((b) => b.status === "reading") ?? null;

  /** "Mara's · Parts Three & Four" */
  function placeLine(m: MeetingRow): string {
    const host = m.host_id ? memberById.get(m.host_id) : null;
    const where = [host ? `${host.name}'s` : null, m.location].filter(Boolean).join(" · ");
    return [where, m.notes].filter(Boolean).join(" · ");
  }

  const myRsvp = next
    ? (attendance[next.id] || []).find((a) => a.member_id === currentMember?.id)?.status
    : undefined;

  const summary = useMemo(() => {
    if (!next) return "";
    const rows = attendance[next.id] || [];
    const going = rows.filter((r) => r.status === "going");
    const cant = rows.filter((r) => r.status === "not_going");
    const answered = new Set(rows.map((r) => r.member_id));
    const silent = members.filter((m) => !answered.has(m.id));

    const parts: string[] = [];
    const meGoing = going.some((g) => g.member_id === currentMember?.id);
    const others = going.length - (meGoing ? 1 : 0);
    if (meGoing) parts.push(others > 0 ? `You + ${others} going` : "You're going");
    else if (going.length) parts.push(`${going.length} going`);
    if (cant.length)
      parts.push(`${cant.map((c) => c.member?.name).filter(Boolean).join(", ")} can't`);
    if (silent.length)
      parts.push(
        silent.length === 1 ? `${silent[0].name} hasn't said` : `${silent.length} haven't said`
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

  function openForm() {
    setForm({ ...EMPTY, book_id: reading?.id ?? "", date: "", time: "19:30" });
    setError("");
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.date) {
      setError("Pick a date.");
      return;
    }
    setSaving(true);
    setError("");

    const book = form.book_id ? bookById.get(form.book_id) : null;
    const payload: Record<string, unknown> = {
      title: book ? book.title : "Book club",
      date: form.date,
      time: form.time || "19:30",
      location: form.location.trim() || null,
      notes: form.notes.trim() || null,
      book_id: form.book_id || null,
      host_id: form.host_id || null,
    };

    let { error: err } = await supabase.from("meetings").insert(payload);
    // host_id may not exist until its migration runs.
    if (err && err.message.includes("host_id")) {
      delete payload.host_id;
      ({ error: err } = await supabase.from("meetings").insert(payload));
    }
    setSaving(false);

    if (err) {
      setError("Couldn't save that. Try again.");
      console.error("[supabase] create meeting:", err.message);
      return;
    }
    setShowForm(false);
    setForm(EMPTY);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("attendance").delete().eq("meeting_id", id);
    await supabase.from("meetings").delete().eq("id", id);
    load();
  }

  const d = next ? new Date(`${next.date}T00:00:00`) : null;

  return (
    <div className="px-5 pt-[62px]">
      <div className="flex items-baseline justify-between">
        <ScreenTitle>Meetings</ScreenTitle>
        {currentMember && !showForm && (
          <OutlineButton className="px-3 py-[6px] text-[12px]" onClick={openForm}>
            New meeting
          </OutlineButton>
        )}
      </div>

      {showForm && (
        <div className="mt-5 space-y-3 rounded-lg border border-tan p-4">
          <Kicker tone="green">New meeting</Kicker>

          <label className="block">
            <span className="mb-[6px] block text-[11.5px] text-muted">Book</span>
            <select
              value={form.book_id}
              onChange={(e) => setForm({ ...form, book_id: e.target.value })}
              className={`control ${field} pr-[30px]`}
            >
              <option value="">No book yet</option>
              {reading && (
                <optgroup label="Reading now">
                  <option value={reading.id}>{reading.title}</option>
                </optgroup>
              )}
              <optgroup label="Up next">
                {books
                  .filter((b) => b.status === "upcoming")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Finished">
                {books
                  .filter((b) => b.status === "completed")
                  .map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>

          <label className="block">
            <span className="mb-[6px] block text-[11.5px] text-muted">Who&apos;s hosting</span>
            <select
              value={form.host_id}
              onChange={(e) => setForm({ ...form, host_id: e.target.value })}
              className={`control ${field} pr-[30px]`}
            >
              <option value="">Nobody yet</option>
              {members.map((m: Member) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-[6px] block text-[11.5px] text-muted">Where (optional)</span>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="The back room at Lila's"
              className={field}
            />
          </label>

          <div className="flex gap-3">
            <label className="block flex-1">
              <span className="mb-[6px] block text-[11.5px] text-muted">Date</span>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={`num ${field}`}
              />
            </label>
            <label className="block w-[120px]">
              <span className="mb-[6px] block text-[11.5px] text-muted">Time</span>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className={`num ${field}`}
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-[6px] block text-[11.5px] text-muted">How far are we reading</span>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Parts Three &amp; Four"
              className={field}
            />
          </label>

          {error && <p className="text-[12px] text-muted">{error}</p>}

          <div className="flex gap-2 pt-1">
            <OutlineButton className="flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </OutlineButton>
            <SolidButton className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Add meeting"}
            </SolidButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 h-20 animate-pulse rounded bg-tan/40" />
      ) : !next ? (
        !showForm && (
          <p className="mt-6 text-[13px] leading-relaxed text-muted">
            Nothing on the calendar. Add a meeting and everyone can say if they&apos;re in.
          </p>
        )
      ) : (
        <div className="mt-6">
          <Kicker tone="green">Next up</Kicker>
          <div className="mt-[10px] flex items-baseline gap-3">
            <Num className="text-[40px] font-semibold leading-none text-ink">{d!.getDate()}</Num>
            <div className="min-w-0">
              <p className="text-[17px] text-ink">
                {d!.toLocaleDateString("en-US", { weekday: "long" })}, {formatClock(next.time)}
              </p>
              <p className="mt-[3px] text-[12.5px] text-muted">
                {placeLine(next) || next.title}
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
          later.map((m, i) => (
            <MeetingRowView
              key={m.id}
              meeting={m}
              place={placeLine(m)}
              last={i === later.length - 1}
              canEdit={Boolean(currentMember)}
              onDelete={() => handleDelete(m.id)}
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-6">
          <Kicker>Already met</Kicker>
          {past.slice(0, 6).map((m, i) => (
            <MeetingRowView
              key={m.id}
              meeting={m}
              place={placeLine(m)}
              last={i === Math.min(past.length, 6) - 1}
              canEdit={Boolean(currentMember)}
              onDelete={() => handleDelete(m.id)}
              dim
            />
          ))}
        </section>
      )}
    </div>
  );
}

function MeetingRowView({
  meeting,
  place,
  last,
  canEdit,
  onDelete,
  dim = false,
}: {
  meeting: MeetingRow;
  place: string;
  last: boolean;
  canEdit: boolean;
  onDelete: () => void;
  dim?: boolean;
}) {
  const d = new Date(`${meeting.date}T00:00:00`);
  return (
    <div className={cn("flex items-baseline gap-[14px] py-[14px]", !last && "row-line")}>
      <Num className={cn("w-[34px] text-[17px] font-semibold", dim ? "text-muted/70" : "text-muted")}>
        {d.getDate()}
      </Num>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14.5px]", dim ? "text-muted" : "text-ink")}>
          {d.toLocaleDateString("en-US", { month: "short" })} · {meeting.title}
        </p>
        <p className="mt-[2px] text-[12px] text-muted">{place || "No details yet"}</p>
      </div>
      {canEdit && (
        <button onClick={onDelete} className="flex-none text-[11px] text-muted/70">
          Remove
        </button>
      )}
    </div>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
