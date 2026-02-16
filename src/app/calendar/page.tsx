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
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
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
      .order("created_at", { ascending: false });
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

  function openCreateForm() {
    setEditingMeeting(null);
    setForm({ title: "", date: "", time: "", location: "", notes: "", book_id: "" });
    setShowForm(true);
  }

  function openEditForm(meeting: Meeting) {
    setEditingMeeting(meeting);
    setForm({
      title: meeting.title,
      date: meeting.date,
      time: meeting.time,
      location: meeting.location || "",
      notes: meeting.notes || "",
      book_id: meeting.book_id || "",
    });
    setShowForm(true);
  }

  async function handleSaveMeeting() {
    if (!form.title || !form.date || !form.time) return;

    const payload = {
      title: form.title,
      date: form.date,
      time: form.time,
      location: form.location || null,
      notes: form.notes || null,
      book_id: form.book_id || null,
    };

    if (editingMeeting) {
      await supabase.from("meetings").update(payload).eq("id", editingMeeting.id);
    } else {
      await supabase.from("meetings").insert(payload);
    }

    setForm({ title: "", date: "", time: "", location: "", notes: "", book_id: "" });
    setShowForm(false);
    setEditingMeeting(null);
    fetchMeetings();
  }

  async function handleDeleteMeeting(meetingId: string) {
    await supabase.from("attendance").delete().eq("meeting_id", meetingId);
    await supabase.from("meetings").delete().eq("id", meetingId);
    fetchMeetings();
  }

  const upcomingMeetings = meetings.filter(
    (m) => new Date(m.date + "T" + m.time) >= new Date()
  );
  const pastMeetings = meetings.filter(
    (m) => new Date(m.date + "T" + m.time) < new Date()
  );

  const selectedBook = form.book_id ? books.find((b) => b.id === form.book_id) : null;

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
            onClick={() => {
              if (showForm) {
                setShowForm(false);
                setEditingMeeting(null);
              } else {
                openCreateForm();
              }
            }}
            className="px-5 py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
          >
            {showForm ? "Cancel" : "Schedule Meeting"}
          </button>
        )}
      </div>

      {/* Create/Edit Meeting Form */}
      {showForm && (
        <div className="bg-white/50 rounded-xl border border-cream-dark p-6 mb-8">
          <h2 className="font-serif text-lg text-charcoal mb-4">
            {editingMeeting ? "Edit Meeting" : "New Meeting"}
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

            {/* Book Selection with cover preview */}
            <div>
              <label className="block font-sans text-xs text-warm-brown/60 uppercase tracking-wider mb-2">
                Book for this meeting
              </label>
              <div className="flex items-start gap-4">
                {selectedBook && (selectedBook.cover_url || selectedBook.thumbnail_url) ? (
                  <img
                    src={selectedBook.cover_url || selectedBook.thumbnail_url || ""}
                    alt={selectedBook.title}
                    className="w-14 h-20 object-cover rounded shadow-md flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-20 bg-cream-dark rounded flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-warm-brown/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                )}
                <select
                  value={form.book_id}
                  onChange={(e) => setForm({ ...form, book_id: e.target.value })}
                  className="flex-1 px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                >
                  <option value="">No book selected</option>
                  {books.filter((b) => b.status === "reading").length > 0 && (
                    <optgroup label="Currently Reading">
                      {books.filter((b) => b.status === "reading").map((b) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {books.filter((b) => b.status === "upcoming").length > 0 && (
                    <optgroup label="Upcoming">
                      {books.filter((b) => b.status === "upcoming").map((b) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </optgroup>
                  )}
                  {books.filter((b) => b.status === "completed").length > 0 && (
                    <optgroup label="Completed">
                      {books.filter((b) => b.status === "completed").map((b) => (
                        <option key={b.id} value={b.id}>{b.title}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </div>
            </div>

            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Notes (optional)"
              className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
              rows={2}
            />
            <button
              onClick={handleSaveMeeting}
              className="w-full py-3 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
            >
              {editingMeeting ? "Save Changes" : "Create Meeting"}
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
                onEdit={openEditForm}
                onDelete={handleDeleteMeeting}
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
                onEdit={openEditForm}
                onDelete={handleDeleteMeeting}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
