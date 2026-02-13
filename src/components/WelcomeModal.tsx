"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface WelcomeModalProps {
  onSelect: (member: Member) => void;
}

export default function WelcomeModal({ onSelect }: WelcomeModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    const { data } = await supabase
      .from("members")
      .select("*")
      .order("name");
    if (data) setMembers(data);
  }

  async function handleAddMember() {
    if (!newName.trim()) return;
    setError("");

    const { data, error: err } = await supabase
      .from("members")
      .insert({ name: newName.trim() })
      .select()
      .single();

    if (err) {
      if (err.code === "23505") {
        setError("That name is already taken.");
      } else {
        setError("Something went wrong. Try again.");
      }
      return;
    }

    if (data) {
      onSelect(data);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-mahogany/60 backdrop-blur-sm">
      <div className="bg-cream rounded-xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="bg-mahogany px-6 py-8 text-center">
          <h1 className="font-serif text-3xl text-cream tracking-wide">
            The Clerb
          </h1>
          <p className="text-cream/70 font-sans text-sm mt-2">
            Welcome to the book club
          </p>
        </div>

        <div className="p-6">
          <h2 className="font-serif text-lg text-charcoal mb-4">
            Who are you?
          </h2>

          {members.length > 0 && (
            <div className="space-y-2 mb-6">
              {members.map((member) => (
                <button
                  key={member.id}
                  onClick={() => onSelect(member)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-cream-dark hover:border-gold hover:bg-gold/10 transition-all text-left"
                >
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-cream font-semibold"
                    style={{ backgroundColor: getAvatarColor(member.name) }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <span className="font-sans text-charcoal">{member.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-cream-dark pt-4">
            <p className="text-sm text-warm-brown font-sans mb-3">
              New here? Add yourself:
            </p>
            {!isAdding ? (
              <button
                onClick={() => setIsAdding(true)}
                className="w-full py-3 rounded-lg border-2 border-dashed border-gold/40 text-gold hover:border-gold hover:bg-gold/5 transition-all font-sans text-sm"
              >
                Join The Clerb
              </button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-red-700 font-sans">{error}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setIsAdding(false);
                      setNewName("");
                      setError("");
                    }}
                    className="flex-1 py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    className="flex-1 py-2 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
                  >
                    Join
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
