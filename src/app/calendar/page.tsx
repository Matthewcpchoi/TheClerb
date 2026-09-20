"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowSquareOut, CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Attendance, Book, Meeting, MeetingOrder, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import PotentialBooks from "@/components/PotentialBooks";
import {
  DeleteButton,
  Kicker,
  Num,
  OutlineButton,
  Rule,
  ScreenTitle,
  Sheet,
  SolidButton,
} from "@/components/ui";
import { cn } from "@/lib/utils";

type Rsvp = "going" | "maybe" | "not_going";
const RSVP_OPTIONS: { key: Rsvp; label: string }[] = [
  { key: "going", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "not_going", label: "Can't" },
];

const EMPTY = { book_id: "", host_id: "", location: "", date: "", time: "19:30", notes: "" };

const field =
  "w-full rounded-lg border border-tan bg-transparent px-3 py-[10px] text-[14px] text-ink outline-none placeholder:text-muted/60 focus:border-green";

export default function MeetScreen() {
  const { currentMember, members } = useMember();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [orders, setOrders] = useState<Record<string, MeetingOrder[]>>({});
  const [books, setBooks] = useState<Book[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [openMeeting, setOpenMeeting] = useState<string | null>(null);
  const [expandGroup, setExpandGroup] = useState<Rsvp | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: m }, { data: a }, { data: b }, ordersRes] = await Promise.all([
      supabase.from("meetings").select("*").order("date").order("time"),
      supabase.from("attendance").select("*, member:members(*)"),
      supabase.from("books").select("*").order("created_at", { ascending: false }),
      supabase.from("meeting_orders").select("*, member:members(*)"),
    ]);
    setMeetings((m || []) as Meeting[]);
    const grouped: Record<string, Attendance[]> = {};
    for (const row of a || []) (grouped[row.meeting_id] ||= []).push(row);
    setAttendance(grouped);
    const byMeeting: Record<string, MeetingOrder[]> = {};
    for (const row of ordersRes.error ? [] : ordersRes.data || [])
      (byMeeting[row.meeting_id] ||= []).push(row as MeetingOrder);
    setOrders(byMeeting);
    setBooks(b || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("meet-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "meeting_orders" }, () => load())
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

  const placeLine = useCallback(
    (m: Meeting) => {
      const host = m.host_id ? memberById.get(m.host_id) : null;
      const where = [host ? `${host.name}'s` : null, m.location].filter(Boolean).join(" · ");
      return [where, m.notes].filter(Boolean).join(" · ");
    },
    [memberById]
  );

  /** Who is in each bucket, plus anyone who hasn't answered. */
  function buckets(meetingId: string) {
    const rows = attendance[meetingId] || [];
    const pick = (s: Rsvp) =>
      rows.filter((r) => r.status === s).map((r) => r.member ?? memberById.get(r.member_id)!);
    const answered = new Set(rows.map((r) => r.member_id));
    return {
      going: pick("going").filter(Boolean),
      maybe: pick("maybe").filter(Boolean),
      not_going: pick("not_going").filter(Boolean),
      silent: members.filter((m) => !answered.has(m.id)),
    };
  }

  async function handleRsvp(meetingId: string, status: Rsvp) {
    if (!currentMember) return;
    setAttendance((prev) => {
      const list = (prev[meetingId] || []).filter((a) => a.member_id !== currentMember.id);
      return {
        ...prev,
        [meetingId]: [
          ...list,
          {
            id: `tmp-${meetingId}`,
            meeting_id: meetingId,
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
        { meeting_id: meetingId, member_id: currentMember.id, status },
        { onConflict: "meeting_id,member_id" }
      );
    load();
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
    if (err && err.message.includes("host_id")) {
      delete payload.host_id;
      ({ error: err } = await supabase.from("meetings").insert(payload));
    }
    setSaving(false);
    if (err) {
      setError("Couldn't save that. Try again.");
      return;
    }
    setShowForm(false);
    setForm(EMPTY);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("attendance").delete().eq("meeting_id", id);
    await supabase.from("meetings").delete().eq("id", id);
    setOpenMeeting(null);
    load();
  }

  const d = next ? new Date(`${next.date}T00:00:00`) : null;
  const nextBuckets = next ? buckets(next.id) : null;
  const myRsvp = next
    ? (attendance[next.id] || []).find((a) => a.member_id === currentMember?.id)?.status
    : undefined;

  const openMeetingRow = meetings.find((m) => m.id === openMeeting) ?? null;

  return (
    <div className="px-5 pt-[62px]">
      <div className="flex items-baseline justify-between">
        <ScreenTitle>Meetings</ScreenTitle>
        {currentMember && !showForm && (
          <OutlineButton
            className="px-3 py-[6px] text-[12px]"
            onClick={() => {
              setForm({ ...EMPTY, book_id: reading?.id ?? "" });
              setError("");
              setShowForm(true);
            }}
          >
            New Meeting
          </OutlineButton>
        )}
      </div>

      {showForm && (
        <div className="mt-5 space-y-3 rounded-lg border border-tan p-4">
          <Kicker tone="green">New Meeting</Kicker>

          <Labelled label="Book">
            <select
              value={form.book_id}
              onChange={(e) => setForm({ ...form, book_id: e.target.value })}
              className={`control ${field} pr-[30px]`}
            >
              <option value="">No book yet</option>
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </Labelled>

          <Labelled label="Who's Hosting">
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
          </Labelled>

          <Labelled label="Where">
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="The back room at Lila's"
              className={field}
            />
          </Labelled>

          <div className="flex gap-3">
            <div className="flex-1">
              <Labelled label="Date">
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={`num ${field}`}
                />
              </Labelled>
            </div>
            <div className="w-[122px]">
              <Labelled label="Time">
                <input
                  type="time"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  className={`num ${field}`}
                />
              </Labelled>
            </div>
          </div>

          <Labelled label="How Far Are We Reading">
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Parts Three &amp; Four"
              className={field}
            />
          </Labelled>

          {error && <p className="text-[12px] text-muted">{error}</p>}

          <div className="flex gap-2 pt-1">
            <OutlineButton className="flex-1" onClick={() => setShowForm(false)}>
              Cancel
            </OutlineButton>
            <SolidButton className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Add Meeting"}
            </SolidButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="mt-6 h-20 animate-pulse rounded bg-tan/40" />
      ) : !next ? (
        !showForm && (
          <p className="mt-6 text-[13px] leading-relaxed text-muted">Nothing on the calendar.</p>
        )
      ) : (
        <div className="mt-6">
          <Kicker tone="green">Next Up</Kicker>
          <button
            onClick={() => setOpenMeeting(next.id)}
            className="mt-[10px] flex w-full items-center gap-3 text-left"
          >
            <div className="w-[52px] flex-none text-center">
              <p className="kicker text-green">
                {d!.toLocaleDateString("en-US", { month: "short" })}
              </p>
              <Num className="mt-[2px] block text-[38px] font-semibold leading-none text-ink">
                {d!.getDate()}
              </Num>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[17px] text-ink">
                {d!.toLocaleDateString("en-US", { weekday: "long" })}, {formatClock(next.time)}
              </p>
              <p className="mt-[3px] text-[12.5px] text-muted">{placeLine(next) || next.title}</p>
            </div>
            <CaretRight size={16} className="flex-none self-center text-green" />
          </button>

          {currentMember && (
            <div className="mt-[18px] flex gap-2">
              {RSVP_OPTIONS.map((o) => (
                <OutlineButton
                  key={o.key}
                  selected={myRsvp === o.key}
                  onClick={() => handleRsvp(next.id, o.key)}
                  className="flex-1 px-0 py-[10px] text-center"
                >
                  {o.label}
                </OutlineButton>
              ))}
            </div>
          )}

          {/* Counts you can open, rather than a sentence listing names. */}
          {nextBuckets && (
            <div className="mt-3">
              <div className="flex gap-2">
                {(
                  [
                    ["going", "Going", nextBuckets.going.length, "text-green"],
                    ["maybe", "Maybe", nextBuckets.maybe.length, "text-muted"],
                    ["not_going", "Can't", nextBuckets.not_going.length, "text-muted"],
                  ] as const
                ).map(([key, label, count, tone]) => (
                  <button
                    key={key}
                    onClick={() => setExpandGroup(expandGroup === key ? null : (key as Rsvp))}
                    className={cn(
                      "flex flex-1 items-baseline justify-center gap-[5px] rounded-lg border py-[7px] text-[11.5px] transition-colors",
                      expandGroup === key ? "border-green bg-green/10" : "border-tan"
                    )}
                  >
                    <Num className={cn("text-[14px] font-semibold", tone)}>{count}</Num>
                    <span className="text-muted">{label}</span>
                  </button>
                ))}
              </div>

              {expandGroup && (
                <div className="pop-in mt-2 rounded-lg bg-tan/20 px-3 py-2">
                  {(nextBuckets[expandGroup] as Member[]).length === 0 ? (
                    <p className="py-1 text-[12.5px] text-muted">Nobody yet.</p>
                  ) : (
                    <p className="text-[13px] text-ink">
                      {(nextBuckets[expandGroup] as Member[]).map((m) => m.name).join(", ")}
                    </p>
                  )}
                  {nextBuckets.silent.length > 0 && (
                    <p className="mt-1 text-[11.5px] text-muted">
                      Yet to answer: {nextBuckets.silent.map((m) => m.name).join(", ")}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="-mx-5 mt-[26px]">
        <Rule />
      </div>

      <section className="mt-5">
        <PotentialBooks currentMember={currentMember} />
      </section>

      <div className="-mx-5 mt-[26px]">
        <Rule />
      </div>

      <section className="mt-5">
        <Kicker>Penciled In</Kicker>
        {later.length === 0 ? (
          <p className="py-4 text-[12.5px] text-muted">Nothing further out yet.</p>
        ) : (
          later.map((m, i) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              place={placeLine(m)}
              last={i === later.length - 1}
              onOpen={() => setOpenMeeting(m.id)}
            />
          ))
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-6">
          <Kicker>Past Clerbs</Kicker>
          {past.map((m, i) => (
            <MeetingRow
              key={m.id}
              meeting={m}
              place={placeLine(m)}
              last={i === past.length - 1}
              onOpen={() => setOpenMeeting(m.id)}
              dim
            />
          ))}
        </section>
      )}

      {openMeetingRow && (
        <MeetingSheet
          meeting={openMeetingRow}
          place={placeLine(openMeetingRow)}
          book={openMeetingRow.book_id ? bookById.get(openMeetingRow.book_id) ?? null : null}
          buckets={buckets(openMeetingRow.id)}
          orders={orders[openMeetingRow.id] || []}
          currentMember={currentMember}
          myRsvp={
            (attendance[openMeetingRow.id] || []).find((a) => a.member_id === currentMember?.id)
              ?.status
          }
          onRsvp={(s) => handleRsvp(openMeetingRow.id, s)}
          onChanged={load}
          onDelete={() => handleDelete(openMeetingRow.id)}
          onClose={() => setOpenMeeting(null)}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------------- details */

function MeetingSheet({
  meeting,
  place,
  book,
  buckets,
  orders,
  currentMember,
  myRsvp,
  onRsvp,
  onChanged,
  onDelete,
  onClose,
}: {
  meeting: Meeting;
  place: string;
  book: Book | null;
  buckets: { going: Member[]; maybe: Member[]; not_going: Member[]; silent: Member[] };
  orders: MeetingOrder[];
  currentMember: Member | null;
  myRsvp?: string;
  onRsvp: (s: Rsvp) => void;
  onChanged: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [item, setItem] = useState(
    orders.find((o) => o.member_id === currentMember?.id)?.item ?? ""
  );
  const [link, setLink] = useState(meeting.order_url ?? "");
  const [savingLink, setSavingLink] = useState(false);
  const d = new Date(`${meeting.date}T00:00:00`);
  const mine = orders.find((o) => o.member_id === currentMember?.id);

  async function saveItem() {
    if (!currentMember || !item.trim()) return;
    await supabase
      .from("meeting_orders")
      .upsert(
        { meeting_id: meeting.id, member_id: currentMember.id, item: item.trim() },
        { onConflict: "meeting_id,member_id" }
      );
    onChanged();
  }

  async function saveLink() {
    setSavingLink(true);
    await supabase.from("meetings").update({ order_url: link.trim() || null }).eq("id", meeting.id);
    setSavingLink(false);
    onChanged();
  }

  return (
    <Sheet title={meeting.title} onClose={onClose}>
      <p className="text-[13px] text-muted">
        {d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })} ·{" "}
        {formatClock(meeting.time)}
      </p>
      {place && <p className="mt-1 text-[13px] text-ink">{place}</p>}
      {book && <p className="mt-1 text-[12.5px] text-muted">Discussing {book.title}</p>}

      {currentMember && (
        <div className="mt-4 flex gap-2">
          {RSVP_OPTIONS.map((o) => (
            <OutlineButton
              key={o.key}
              selected={myRsvp === o.key}
              onClick={() => onRsvp(o.key)}
              className="flex-1 px-0 py-[9px] text-center"
            >
              {o.label}
            </OutlineButton>
          ))}
        </div>
      )}

      <div className="mt-5 space-y-2">
        {(
          [
            ["Going", buckets.going],
            ["Maybe", buckets.maybe],
            ["Can't", buckets.not_going],
            ["Yet to Answer", buckets.silent],
          ] as const
        ).map(([label, list]) =>
          list.length ? (
            <div key={label} className="flex gap-3 text-[13px]">
              <span className="w-[86px] flex-none text-muted">{label}</span>
              <span className="min-w-0 flex-1 text-ink">{list.map((m) => m.name).join(", ")}</span>
            </div>
          ) : null
        )}
      </div>

      <div className="my-5">
        <Rule />
      </div>

      {/* Food. The app collects the order; the basket itself lives on Uber Eats. */}
      <Kicker>Group Order</Kicker>
      <div className="mt-2">
        {orders.length === 0 && <p className="py-2 text-[12.5px] text-muted">Nothing yet.</p>}
        {orders.map((o, i) => (
          <div
            key={o.id}
            className={cn("flex items-center gap-3 py-[9px]", i < orders.length - 1 && "row-line")}
          >
            <span className="w-[86px] flex-none text-[12.5px] text-muted">
              {o.member?.name ?? "Someone"}
            </span>
            <span className="min-w-0 flex-1 text-[13.5px] text-ink">{o.item}</span>
            {o.member_id === currentMember?.id && (
              <DeleteButton
                label="Remove your order"
                onDelete={async () => {
                  await supabase.from("meeting_orders").delete().eq("id", o.id);
                  onChanged();
                }}
              />
            )}
          </div>
        ))}
      </div>

      {currentMember && (
        <div className="mt-3 flex gap-2">
          <input
            value={item}
            onChange={(e) => setItem(e.target.value)}
            placeholder="What do you want?"
            className={`${field} flex-1`}
          />
          <SolidButton onClick={saveItem} disabled={!item.trim()}>
            {mine ? "Update" : "Add"}
          </SolidButton>
        </div>
      )}

      {meeting.order_url ? (
        <a
          href={meeting.order_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center justify-center gap-2 rounded-lg bg-ink py-[11px] text-[13px] font-medium text-ground"
        >
          Join the Order
          <ArrowSquareOut size={14} />
        </a>
      ) : (
        currentMember && (
          <div className="mt-3 space-y-2">
            <a
              href="https://www.ubereats.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 rounded-lg border border-green py-[10px] text-[13px] font-medium text-ink"
            >
              Start It on Uber Eats
              <ArrowSquareOut size={14} />
            </a>
            <div className="flex gap-2">
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="Paste the group order link"
                className={`${field} flex-1`}
              />
              <SolidButton onClick={saveLink} disabled={savingLink || !link.trim()}>
                Share
              </SolidButton>
            </div>
          </div>
        )
      )}

      {currentMember && (
        <button onClick={onDelete} className="mt-6 w-full py-2 text-[12px] text-muted/70">
          Delete This Meeting
        </button>
      )}
    </Sheet>
  );
}

function MeetingRow({
  meeting,
  place,
  last,
  onOpen,
  dim = false,
}: {
  meeting: Meeting;
  place: string;
  last: boolean;
  onOpen: () => void;
  dim?: boolean;
}) {
  const d = new Date(`${meeting.date}T00:00:00`);
  return (
    <button
      onClick={onOpen}
      className={cn("flex w-full items-center gap-[14px] py-[14px] text-left", !last && "row-line")}
    >
      <div className="w-[38px] flex-none text-center">
        <p className={cn("kicker", dim ? "text-muted/70" : "text-green")}>
          {d.toLocaleDateString("en-US", { month: "short" })}
        </p>
        <Num
          className={cn(
            "mt-[1px] block text-[19px] font-semibold leading-none",
            dim ? "text-muted/70" : "text-ink"
          )}
        >
          {d.getDate()}
        </Num>
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[14.5px]", dim ? "text-muted" : "text-ink")}>
          {meeting.title}
        </p>
        <p className="mt-[2px] truncate text-[12px] text-muted">{place || "No details yet"}</p>
      </div>
      <CaretRight size={14} className="flex-none self-center text-muted/50" />
    </button>
  );
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block text-[11.5px] text-muted">{label}</span>
      {children}
    </label>
  );
}

function formatClock(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? "PM" : "AM"}`;
}
