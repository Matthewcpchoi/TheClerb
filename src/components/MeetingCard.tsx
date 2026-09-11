"use client";

import { useState } from "react";
import Link from "next/link";
import { Meeting, Attendance } from "@/types";
import { formatTime, cn } from "@/lib/utils";
import AttendanceTracker from "./AttendanceTracker";
import BookCover from "./BookCover";
import { Button, Card } from "./ui";

interface MeetingCardProps {
  meeting: Meeting;
  attendance: Attendance[];
  currentMemberId: string | null;
  onRsvp: (meetingId: string, status: "going" | "maybe" | "not_going") => void;
  onEdit: (meeting: Meeting) => void;
  onDelete: (meetingId: string) => void;
}

export default function MeetingCard({
  meeting,
  attendance,
  currentMemberId,
  onRsvp,
  onEdit,
  onDelete,
}: MeetingCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isPast = new Date(meeting.date + "T" + meeting.time) < new Date();
  const d = new Date(meeting.date + "T00:00:00");

  return (
    <Card padded={false} className={cn(isPast && "opacity-75")}>
      <div className="flex">
        {/* Date block */}
        <div
          className={cn(
            "w-[72px] sm:w-20 flex-shrink-0 flex flex-col items-center justify-center py-5 border-r border-charcoal/[0.06]",
            isPast ? "bg-charcoal/[0.03]" : "bg-gold/10"
          )}
        >
          <p className="font-sans text-[10px] uppercase tracking-wider text-warm-brown/70">
            {d.toLocaleDateString("en-US", { month: "short" })}
          </p>
          <p
            className={cn(
              "font-sans text-3xl font-semibold leading-none tabular-nums mt-1",
              isPast ? "text-warm-brown" : "text-[#8a6a22]"
            )}
          >
            {d.getDate()}
          </p>
          <p className="font-sans text-[10px] text-warm-brown/60 mt-1">
            {d.toLocaleDateString("en-US", { weekday: "short" })}
          </p>
        </div>

        <div className="flex-1 min-w-0 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            {meeting.book && (
              <Link href={`/book/${meeting.book.id}`} className="flex-shrink-0">
                <BookCover book={meeting.book} className="w-12 aspect-[2/3] rounded-md shadow-md" />
              </Link>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="font-serif text-lg text-charcoal leading-snug">{meeting.title}</h3>
              <p className="font-sans text-sm text-warm-brown mt-1">
                {formatTime(meeting.time)}
                {meeting.location && <span> · {meeting.location}</span>}
              </p>
              {meeting.book && (
                <p className="font-sans text-xs text-warm-brown/60 mt-0.5 truncate">
                  Discussing <span className="text-charcoal/70">{meeting.book.title}</span>
                </p>
              )}
            </div>

            {currentMemberId && (
              <div className="flex items-center -mr-1.5 -mt-1">
                <button
                  onClick={() => onEdit(meeting)}
                  className="p-2 rounded-lg text-warm-brown/50 hover:text-charcoal hover:bg-charcoal/5 transition-colors"
                  title="Edit"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 rounded-lg text-warm-brown/50 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {meeting.notes && (
            <p className="font-sans text-sm text-charcoal/70 mt-3 leading-relaxed">{meeting.notes}</p>
          )}

          <div className="mt-4">
            <AttendanceTracker
              attendance={attendance}
              currentMemberId={currentMemberId}
              onRsvp={(status) => onRsvp(meeting.id, status)}
              compact={isPast}
            />
          </div>

          {confirmDelete && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5">
              <p className="font-sans text-xs text-red-800 flex-1">Delete this meeting?</p>
              <Button
                size="sm"
                variant="danger"
                onClick={() => {
                  onDelete(meeting.id);
                  setConfirmDelete(false);
                }}
              >
                Delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                Keep
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
