"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { Avatar, Button, inputClass } from "./ui";

interface WelcomeModalProps {
  onSelect: (member: Member) => void;
}

export default function WelcomeModal({ onSelect }: WelcomeModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("members")
      .select("*")
      .order("name")
      .then(({ data }) => data && setMembers(data));
  }, []);

  async function handleAddMember() {
    if (!newName.trim()) return;
    setError("");
    const { data, error: err } = await supabase
      .from("members")
      .insert({ name: newName.trim() })
      .select()
      .single();
    if (err) {
      setError(err.code === "23505" ? "That name is already taken." : "Something went wrong. Try again.");
      return;
    }
    if (data) onSelect(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/55 backdrop-blur-sm sm:p-4">
      <div className="bg-cream w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        <div className="bg-mahogany px-6 pt-8 pb-7 text-center">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-light/80 mb-2">
            Welcome to
          </p>
          <h1 className="font-serif text-4xl text-cream tracking-tight">The Clerb</h1>
        </div>

        <div className="p-6">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-brown mb-3">
            Who are you?
          </p>

          {members.length > 0 && (
            <div className="space-y-1.5 mb-5 max-h-[40vh] overflow-y-auto -mx-1 px-1">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-charcoal/[0.08] bg-white/60 hover:border-gold hover:bg-gold/5 transition-all text-left"
                >
                  <Avatar name={m.name} size="md" />
                  <span className="font-sans text-[15px] text-charcoal">{m.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className={members.length > 0 ? "border-t border-charcoal/[0.06] pt-4" : ""}>
            {!isAdding ? (
              <Button variant="secondary" className="w-full" onClick={() => setIsAdding(true)}>
                I&apos;m new here
              </Button>
            ) : (
              <div className="space-y-3">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
                  placeholder="Your name"
                  className={inputClass}
                  autoFocus
                />
                {error && <p className="font-sans text-sm text-red-700">{error}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setIsAdding(false);
                      setNewName("");
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleAddMember}>
                    Join
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
