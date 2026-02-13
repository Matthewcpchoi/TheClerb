"use client";

import { Meeting, Attendance } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import AttendanceTracker from "./AttendanceTracker";
import Link from "next/link";

interface MeetingCardProps {
  meeting: Meeting;
  attendance: Attendance[];
  currentMemberId: string | null;
  onRsvp: (meetingId: string, status: "going" | "maybe" | "not_going") => void;
}

export default function MeetingCard({
  meeting,
  attendance,
  currentMemberId,
  onRsvp,
}: MeetingCardProps) {
  const isPast = new Date(meeting.date + "T" + meeting.time) < new Date();

  return (
    <div
      className={`rounded-xl border p-5 transition-all ${
        isPast
          ? "border-cream-dark/50 bg-cream-dark/20"
          : "border-gold/30 bg-white/50 shadow-sm"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-serif text-lg text-charcoal">{meeting.title}</h3>
          <p className="font-sans text-sm text-warm-brown mt-1">
            {formatDate(meeting.date)} at {formatTime(meeting.time)}
          </p>
        </div>
        {isPast && (
          <span className="px-2 py-1 bg-cream-dark rounded text-xs font-sans text-warm-brown/60">
            Past
          </span>
        )}
      </div>

      {meeting.book && (
        <Link
          href={`/book/${meeting.book.id}`}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mahogany/5 hover:bg-mahogany/10 transition-colors mb-3"
        >
          {meeting.book.thumbnail_url && (
            <img
              src={meeting.book.thumbnail_url}
              alt={meeting.book.title}
              className="w-6 h-8 object-cover rounded shadow-sm"
            />
          )}
          <span className="font-sans text-xs text-mahogany">
            {meeting.book.title}
          </span>
        </Link>
      )}

      {meeting.location && (
        <p className="font-sans text-sm text-warm-brown/70 mb-2">
          Location: {meeting.location}
        </p>
      )}

      {meeting.notes && (
        <p className="font-sans text-sm text-charcoal/70 mb-4 italic">
          {meeting.notes}
        </p>
      )}

      <AttendanceTracker
        attendance={attendance}
        currentMemberId={currentMemberId}
        onRsvp={(status) => onRsvp(meeting.id, status)}
      />
    </div>
  );
}
