"use client";

import { Attendance } from "@/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./ui";

interface AttendanceTrackerProps {
  attendance: Attendance[];
  currentMemberId: string | null;
  onRsvp: (status: "going" | "maybe" | "not_going") => void;
  /** Past meetings: show who came, hide the buttons. */
  compact?: boolean;
}

const OPTIONS = [
  { status: "going", label: "Going", active: "bg-sage text-cream border-sage" },
  { status: "maybe", label: "Maybe", active: "bg-gold text-cream border-gold" },
  { status: "not_going", label: "Can't", active: "bg-warm-brown text-cream border-warm-brown" },
] as const;

export default function AttendanceTracker({
  attendance,
  currentMemberId,
  onRsvp,
  compact = false,
}: AttendanceTrackerProps) {
  const mine = attendance.find((a) => a.member_id === currentMemberId);
  const going = attendance.filter((a) => a.status === "going");
  const maybe = attendance.filter((a) => a.status === "maybe");

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
      {currentMemberId && !compact && (
        <div className="inline-flex rounded-xl border border-charcoal/10 bg-white/60 p-0.5">
          {OPTIONS.map((o) => (
            <button
              key={o.status}
              onClick={() => onRsvp(o.status)}
              className={cn(
                "h-8 px-3.5 rounded-[10px] font-sans text-xs font-medium transition-all border border-transparent",
                mine?.status === o.status ? o.active : "text-warm-brown hover:bg-charcoal/5"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {(going.length > 0 || maybe.length > 0) && (
        <div className="flex items-center gap-4">
          {going.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex -space-x-2">
                {going.map((a) => (
                  <Avatar key={a.id} name={a.member?.name || "?"} size="sm" className="ring-2 ring-cream" />
                ))}
              </div>
              <span className="font-sans text-xs text-sage font-medium">
                {going.length} going
              </span>
            </div>
          )}
          {maybe.length > 0 && (
            <span className="font-sans text-xs text-warm-brown/70">{maybe.length} maybe</span>
          )}
        </div>
      )}

      {attendance.length === 0 && compact && (
        <span className="font-sans text-xs text-warm-brown/50">No RSVPs recorded</span>
      )}
    </div>
  );
}
