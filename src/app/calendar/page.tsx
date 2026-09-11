"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Meeting, Attendance, Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import MeetingCard from "@/components/MeetingCard";
import BookCover from "@/components/BookCover";
import { Button, Card, EmptyState, PageHeader, SectionTitle, inputClass, textareaClass } from "@/components/ui";

const EMPTY_FORM = { title: "", date: "", time: "", location: "", notes: "", book_id: "" };

export default function CalendarPage() {
  const { currentMember } = useMember();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const fetchMeetings = useCallback(async () => {
    const { data } = await supabase
      .from("meetings")
      .select("*, book:books(*)")
      .order("date", { ascending: true })
      .order("time", { ascending: true });
    if (data) setMeetings(data);
  }, []);

  const fetchAttendance = useCallback(async () => {
    const { data } = await supabase.from("attendance").select("*, member:members(*)");
    if (data) {
      const grouped: Record<string, Attendance[]> = {};
      for (const a of data) (grouped[a.meeting_id] ||= []).push(a);
      setAttendance(grouped);
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    const { data } = await supabase.from("books").select("*").order("created_at", { ascending: false });
    if (data) setBooks(data);
  }, []);

  useEffect(() => {
    fetchMeetings();
    fetchAttendance();
    fetchBooks();
  }, [fetchMeetings, fetchAttendance, fetchBooks]);

  useEffect(() => {
    const channel = supabase
      .channel("attendance-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, () => fetchAttendance())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendance]);

  async function handleRsvp(meetingId: string, status: "going" | "maybe" | "not_going") {
    if (!currentMember) return;
    // Optimistic: flip the button immediately, reconcile on the realtime event.
    setAttendance((prev) => {
      const list = (prev[meetingId] || []).filter((a) => a.member_id !== currentMember.id);
      return {
        ...prev,
        [meetingId]: [
          ...list,
          { id: `tmp-${meetingId}`, meeting_id: meetingId, member_id: currentMember.id, status, member: currentMember },
        ],
      };
    });
    await supabase
      .from("attendance")
      .upsert({ meeting_id: meetingId, member_id: currentMember.id, status }, { onConflict: "meeting_id,member_id" });
    fetchAttendance();
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(m: Meeting) {
    setEditing(m);
    setForm({
      title: m.title,
      date: m.date,
      time: m.time,
      location: m.location || "",
      notes: m.notes || "",
      book_id: m.book_id || "",
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave() {
    if (!form.title || !form.date || !form.time) return;
    const payload = {
      title: form.title,
      date: form.date,
      time: form.time,
      location: form.location || null,
      notes: form.notes || null,
      book_id: form.book_id || null,
    };
    if (editing) await supabase.from("meetings").update(payload).eq("id", editing.id);
    else await supabase.from("meetings").insert(payload);
    setForm(EMPTY_FORM);
    setShowForm(false);
    setEditing(null);
    fetchMeetings();
  }

  async function handleDelete(id: string) {
    await supabase.from("meetings").delete().eq("id", id);
    fetchMeetings();
  }

  const now = new Date();
  const upcoming = meetings.filter((m) => new Date(m.date + "T" + m.time) >= now);
  const past = meetings.filter((m) => new Date(m.date + "T" + m.time) < now).reverse();
  const selectedBook = form.book_id ? books.find((b) => b.id === form.book_id) : null;
  const groups = [
    { label: "Reading now", items: books.filter((b) => b.status === "reading") },
    { label: "Up next", items: books.filter((b) => b.status === "upcoming") },
    { label: "Finished", items: books.filter((b) => b.status === "completed") },
  ];

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="The Clerb"
        title="Calendar"
        subtitle={upcoming.length ? `${upcoming.length} upcoming` : "Nothing scheduled"}
        action={
          currentMember ? (
            <Button
              variant={showForm ? "secondary" : "primary"}
              onClick={() => (showForm ? (setShowForm(false), setEditing(null)) : openCreate())}
            >
              {showForm ? "Cancel" : "Schedule"}
            </Button>
          ) : undefined
        }
      />

      {showForm && (
        <Card className="mb-8">
          <SectionTitle>{editing ? "Edit meeting" : "New meeting"}</SectionTitle>
          <div className="space-y-3">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Meeting title"
              className={inputClass}
              autoFocus
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className={inputClass}
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className={inputClass}
              />
            </div>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Location (optional)"
              className={inputClass}
            />

            <div className="flex items-center gap-3">
              {selectedBook ? (
                <BookCover book={selectedBook} className="w-11 aspect-[2/3] rounded-md shadow flex-shrink-0" />
              ) : (
                <div className="w-11 aspect-[2/3] rounded-md bg-charcoal/[0.05] flex-shrink-0" />
              )}
              <select
                value={form.book_id}
                onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                className={inputClass}
              >
                <option value="">No book</option>
                {groups.map(
                  (g) =>
                    g.items.length > 0 && (
                      <optgroup key={g.label} label={g.label}>
                        {g.items.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.title}
                          </option>
                        ))}
                      </optgroup>
                    )
                )}
              </select>
            </div>

            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className={textareaClass}
              rows={2}
            />
            <Button className="w-full" size="lg" onClick={handleSave} disabled={!form.title || !form.date || !form.time}>
              {editing ? "Save changes" : "Create meeting"}
            </Button>
          </div>
        </Card>
      )}

      <section className="mb-10">
        <SectionTitle>Upcoming</SectionTitle>
        {upcoming.length > 0 ? (
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                attendance={attendance[m.id] || []}
                currentMemberId={currentMember?.id || null}
                onRsvp={handleRsvp}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              title="No meetings on the books"
              body="Schedule the next one and everyone can RSVP with a tap."
              action={currentMember ? <Button onClick={openCreate}>Schedule a meeting</Button> : undefined}
            />
          </Card>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <SectionTitle>Past</SectionTitle>
          <div className="space-y-3">
            {past.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                attendance={attendance[m.id] || []}
                currentMemberId={currentMember?.id || null}
                onRsvp={handleRsvp}
                onEdit={openEdit}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
