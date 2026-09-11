"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";

interface MemberSelectorProps {
  currentMember: Member | null;
  onSelect: (member: Member) => void;
}

export default function MemberSelector({ currentMember, onSelect }: MemberSelectorProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase
      .from("members")
      .select("*")
      .order("name")
      .then(({ data }) => data && setMembers(data));
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 h-10 pl-1.5 pr-2.5 rounded-full hover:bg-charcoal/[0.05] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        {currentMember ? (
          <>
            <Avatar name={currentMember.name} size="sm" />
            <span className="font-sans text-sm text-charcoal hidden sm:inline">{currentMember.name.split(" ")[0]}</span>
          </>
        ) : (
          <span className="font-sans text-sm text-mahogany px-1.5">Who are you?</span>
        )}
        <svg
          className={cn("w-3.5 h-3.5 text-warm-brown/60 transition-transform", isOpen && "rotate-180")}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-60 bg-cream border border-charcoal/[0.08] rounded-2xl shadow-[0_12px_40px_-12px_rgba(43,38,34,0.35)] z-50 p-1.5 expand-in">
          <p className="font-sans text-[10px] font-semibold uppercase tracking-[0.18em] text-warm-brown/70 px-2.5 pt-2 pb-1.5">
            Switch member
          </p>
          <ul role="listbox">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  role="option"
                  aria-selected={currentMember?.id === m.id}
                  onClick={() => {
                    onSelect(m);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors",
                    currentMember?.id === m.id ? "bg-gold/15 text-charcoal" : "hover:bg-charcoal/[0.05] text-charcoal"
                  )}
                >
                  <Avatar name={m.name} size="sm" />
                  <span className="font-sans text-sm">{m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
