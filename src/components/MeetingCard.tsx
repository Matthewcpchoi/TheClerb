"use client";

import { useState } from "react";
import { Meeting, Attendance } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import AttendanceTracker from "./AttendanceTracker";
import Link from "next/link";

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isPast = new Date(meeting.date + "T" + meeting.time) < new Date();
  const hasBookCover = meeting.book && (meeting.book.cover_url || meeting.book.thumbnail_url);

  return (
    <div
      className={`rounded-xl border overflow-hidden transition-all ${
        isPast ? "border-cream-dark/50 bg-cream-dark/20" : "border-gold/30 bg-white/50 shadow-sm"
      }`}
    >
      <div className="flex">
        {hasBookCover && (
          <Link
            href={`/book/${meeting.book!.id}`}
            className="w-24 min-h-[170px] flex-shrink-0 bg-cream-dark/30 flex items-center justify-center p-2"
          >
            <img
              src={meeting.book!.cover_url || meeting.book!.thumbnail_url || ""}
              alt={meeting.book!.title}
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          </Link>
        )}

        <div className="flex-1 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-serif text-lg text-charcoal">{meeting.title}</h3>
              <p className="font-sans text-sm text-warm-brown mt-1">
                {formatDate(meeting.date)} at {formatTime(meeting.time)}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {isPast && (
                <span className="px-2 py-1 bg-cream-dark rounded text-xs font-sans text-warm-brown/60">Past</span>
              )}
              {currentMemberId && (
                <>
                  <button
                    onClick={() => onEdit(meeting)}
                    className="p-1.5 rounded-lg hover:bg-cream-dark/60 transition-colors text-warm-brown/50 hover:text-warm-brown"
                    title="Edit meeting"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-warm-brown/50 hover:text-red-500"
                    title="Delete meeting"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          </div>

          {meeting.book && !hasBookCover && (
            <Link
              href={`/book/${meeting.book.id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-mahogany/5 hover:bg-mahogany/10 transition-colors mb-3"
            >
              <span className="font-sans text-xs text-mahogany">{meeting.book.title}</span>
            </Link>
          )}

          {meeting.location && <p className="font-sans text-sm text-warm-brown/70 mb-2">Location: {meeting.location}</p>}

          {meeting.notes && <p className="font-sans text-sm text-charcoal/70 mb-4 italic">{meeting.notes}</p>}

          <AttendanceTracker
            attendance={attendance}
            currentMemberId={currentMemberId}
            onRsvp={(status) => onRsvp(meeting.id, status)}
          />

          {showDeleteConfirm && (
            <div className="mt-3 flex items-center gap-2 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="font-sans text-xs text-red-700 flex-1">Delete this meeting?</p>
              <button
                onClick={() => {
                  onDelete(meeting.id);
                  setShowDeleteConfirm(false);
                }}
                className="px-3 py-1 rounded bg-red-600 text-white font-sans text-xs hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-3 py-1 rounded bg-white text-charcoal font-sans text-xs border border-cream-dark hover:bg-cream-dark/30 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
