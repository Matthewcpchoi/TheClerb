"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface MemberSelectorProps {
  currentMember: Member | null;
  onSelect: (member: Member) => void;
}

export default function MemberSelector({
  currentMember,
  onSelect,
}: MemberSelectorProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMembers();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function fetchMembers() {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("name");
    if (data) setMembers(data);
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-cream-dark transition-colors"
      >
        {currentMember ? (
          <>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-cream text-xs font-semibold"
              style={{ backgroundColor: getAvatarColor(currentMember.name) }}
            >
              {getInitials(currentMember.name)}
            </div>
            <span className="text-sm font-sans text-charcoal hidden sm:inline">
              {currentMember.name}
            </span>
          </>
        ) : (
          <span className="text-sm font-sans text-espresso">Who are you?</span>
        )}
        <svg
          className={`w-4 h-4 text-espresso transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-cream border border-cream-dark rounded-lg shadow-lg z-50 overflow-hidden">
          <div className="p-2">
            <p className="text-xs text-warm-brown font-sans uppercase tracking-wider px-2 py-1">
              Select Member
            </p>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => {
                  onSelect(member);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-2 px-2 py-2 rounded-md text-left transition-colors ${
                  currentMember?.id === member.id
                    ? "bg-gold/20 text-mahogany"
                    : "hover:bg-cream-dark text-charcoal"
                }`}
              >
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-cream text-xs font-semibold flex-shrink-0"
                  style={{ backgroundColor: getAvatarColor(member.name) }}
                >
                  {getInitials(member.name)}
                </div>
                <span className="text-sm font-sans">{member.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
