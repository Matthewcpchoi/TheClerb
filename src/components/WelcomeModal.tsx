"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { useMember } from "./MemberProvider";
import { Initials, Kicker, OutlineButton, SolidButton } from "./ui";

/**
 * Joining is not in the design — see the README's Gaps. Built in the same
 * palette and type scale so it does not read as a different app.
 */
export default function WelcomeModal({ onSelect }: { onSelect: (m: Member) => void }) {
  const { members } = useMember();
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  async function handleAdd() {
    if (!newName.trim()) return;
    setError("");
    const { data, error: err } = await supabase
      .from("members")
      .insert({ name: newName.trim() })
      .select()
      .single();
    if (err) {
      setError(err.code === "23505" ? "That name is taken." : "Something went wrong.");
      return;
    }
    if (data) onSelect(data);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-[448px] rounded-t-[26px] bg-ground p-5 pb-8 sm:rounded-[26px]">
        <Kicker tone="green" wide>
          The Clerb
        </Kicker>
        <p className="mt-2 text-[24px] font-medium leading-none tracking-[-0.02em] text-ink">
          Who are you?
        </p>

        {members.length > 0 && (
          <div className="mt-5 max-h-[45vh] overflow-y-auto">
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => onSelect(m)}
                className="row-line flex w-full items-center gap-3 py-[11px] text-left"
              >
                <Initials name={m.name} size={36} />
                <span className="text-[14.5px] text-ink">{m.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="mt-5">
          {!isAdding ? (
            <OutlineButton className="w-full" onClick={() => setIsAdding(true)}>
              I&apos;m new here
            </OutlineButton>
          ) : (
            <div className="space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Your name"
                autoFocus
                className="w-full rounded-lg border border-tan bg-transparent px-3 py-[10px] text-[15px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
              />
              {error && <p className="text-[12px] text-muted">{error}</p>}
              <div className="flex gap-2">
                <OutlineButton className="flex-1" onClick={() => setIsAdding(false)}>
                  Cancel
                </OutlineButton>
                <SolidButton className="flex-1" onClick={handleAdd}>
                  Join
                </SolidButton>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
