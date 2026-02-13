"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Meeting, Attendance, Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import MeetingCard from "@/components/MeetingCard";

export default function CalendarPage() {
  const { currentMember } = useMember();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>(
    {}
  );
  const [books, setBooks] = useState<Book[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    date: "",
    time: "",
    location: "",
    notes: "",
    book_id: "",
  });

  const fetchMeetings = useCallback(async () => {
    const { data } = await supabase
      .from("meetings")
      .select("*, book:books(*)")
      .order("date", { ascending: true });
    if (data) setMeetings(data);
  }, []);

  const fetchAttendance = useCallback(async () => {
    const { data } = await supabase
      .from("attendance")
      .select("*, member:members(*)");
    if (data) {
      const grouped: Record<string, Attendance[]> = {};
      data.forEach((a) => {
        if (!grouped[a.meeting_id]) grouped[a.meeting_id] = [];
        grouped[a.meeting_id].push(a);
      });
      setAttendance(grouped);
    }
  }, []);

  const fetchBooks = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .in("status", ["reading", "upcoming"])
      .order("created_at", { ascending: false });
    if (data) setBooks(data);
  }, []);

  useEffect(() => {
    fetchMeetings();
    fetchAttendance();
    fetchBooks();
  }, [fetchMeetings, fetchAttendance, fetchBooks]);

  // Real-time attendance updates
  useEffect(() => {
    const channel = supabase
      .channel("attendance-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance" },
        () => {
          fetchAttendance();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAttendance]);

  async function handleRsvp(
    meetingId: string,
    status: "going" | "maybe" | "not_going"
  ) {
    if (!currentMember) return;

    await supabase.from("attendance").upsert(
      {
        meeting_id: meetingId,
        member_id: currentMember.id,
        status,
      },
      { onConflict: "meeting_id,member_id" }
    );

    fetchAttendance();
  }

  async function handleCreateMeeting() {
    if (!form.title || !form.date || !form.time) return;

    await supabase.from("meetings").insert({
      title: form.title,
      date: form.date,
      time: form.time,
      location: form.location || null,
      notes: form.notes || null,
      book_id: form.book_id || null,
    });

    setForm({ title: "", date: "", time: "", location: "", notes: "", book_id: "" });
    setShowForm(false);
    fetchMeetings();
  }

  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date + "T" + m.time) >= new Date()
  );
  const pastMeetings = meetings.filter(
    (m) => new Date(m.date + "T" + m.time) < new Date()
  );

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Calendar</h1>
          <p className="font-sans text-sm text-warm-brown/60 mt-1">
            Gatherings and discussions
          </p>
        </div>
        {currentMember && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-5 py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
          >
            {showForm ? "Cancel" : "Schedule Meeting"}
          </button>
        )}
      </div>

      {/* Create Meeting Form */}
      {showForm && (
        <div className="bg-white/50 rounded-xl border border-cream-dark p-6 mb-8">
          <h2 className="font-serif text-lg text-charcoal mb-4">
            New Meeting
          </h2>
          <div className="space-y-4">
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Meeting title"
              className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
                className="px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              />
            </div>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="Location (optional)"
              className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
            />
            {books.length > 0 && (
              <select
                value={form.book_id}
                onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              >
                <option value="">Select a book (optional)</option>
                {books.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            )}
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
              rows={2}
            />
            <button
              onClick={handleCreateMeeting}
              className="w-full py-3 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
            >
              Create Meeting
            </button>
          </div>
        </div>
      )}

      {/* Upcoming Meetings */}
      <div className="mb-10">
        <h2 className="font-serif text-xl text-charcoal mb-4">Upcoming</h2>
        {upcomingMeetings.length > 0 ? (
          <div className="space-y-4">
            {upcomingMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                attendance={attendance[meeting.id] || []}
                currentMemberId={currentMember?.id || null}
                onRsvp={handleRsvp}
              />
            ))}
          </div>
        ) : (
          <p className="font-sans text-sm text-warm-brown/60 italic py-8 text-center">
            No upcoming meetings scheduled.
          </p>
        )}
      </div>

      {/* Past Meetings */}
      {pastMeetings.length > 0 && (
        <div>
          <h2 className="font-serif text-xl text-charcoal mb-4">Past</h2>
          <div className="space-y-4">
            {pastMeetings.map((meeting) => (
              <MeetingCard
                key={meeting.id}
                meeting={meeting}
                attendance={attendance[meeting.id] || []}
                currentMemberId={currentMember?.id || null}
                onRsvp={handleRsvp}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
