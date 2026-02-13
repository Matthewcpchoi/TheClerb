"use client";

import { Attendance } from "@/types";
import { getInitials, getAvatarColor, cn } from "@/lib/utils";

interface AttendanceTrackerProps {
  attendance: Attendance[];
  currentMemberId: string | null;
  onRsvp: (status: "going" | "maybe" | "not_going") => void;
}

const STATUS_LABELS: Record<string, string> = {
  going: "Going",
  maybe: "Maybe",
  not_going: "Can't Make It",
};

export default function AttendanceTracker({
  attendance,
  currentMemberId,
  onRsvp,
}: AttendanceTrackerProps) {
  const myRsvp = attendance.find((a) => a.member_id === currentMemberId);
  const goingList = attendance.filter((a) => a.status === "going");
  const maybeList = attendance.filter((a) => a.status === "maybe");
  const notGoingList = attendance.filter((a) => a.status === "not_going");

  return (
    <div className="space-y-3">
      {/* RSVP buttons */}
      {currentMemberId && (
        <div className="flex gap-2">
          {(["going", "maybe", "not_going"] as const).map((status) => (
            <button
              key={status}
              onClick={() => onRsvp(status)}
              className={cn(
                "flex-1 py-2 rounded-lg font-sans text-xs transition-colors",
                myRsvp?.status === status
                  ? status === "going"
                    ? "bg-sage text-cream"
                    : status === "maybe"
                      ? "bg-gold text-cream"
                      : "bg-warm-brown text-cream"
                  : "border border-cream-dark text-warm-brown hover:bg-cream-dark"
              )}
            >
              {STATUS_LABELS[status]}
            </button>
          ))}
        </div>
      )}

      {/* Attendance summary */}
      <div className="flex gap-4">
        {[
          { list: goingList, label: "Going", color: "text-sage" },
          { list: maybeList, label: "Maybe", color: "text-gold" },
          { list: notGoingList, label: "Can't", color: "text-warm-brown/50" },
        ].map(({ list, label, color }) =>
          list.length > 0 ? (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`font-sans text-xs ${color}`}>{label}:</span>
              <div className="flex -space-x-1.5">
                {list.map((a) => (
                  <div
                    key={a.id}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-cream border-2 border-cream flex-shrink-0"
                    style={{
                      backgroundColor: getAvatarColor(
                        a.member?.name || "?"
                      ),
                      fontSize: "8px",
                    }}
                    title={a.member?.name || "Member"}
                  >
                    {getInitials(a.member?.name || "?")}
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>
    </div>
  );
}
