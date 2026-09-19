"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { Initials, Kicker, Num, OutlineButton, Rule, SolidButton } from "@/components/ui";
import { cn } from "@/lib/utils";

interface Stats {
  read: number;
  avg: number | null;
  attended: number;
  highest: { book: Book; score: number }[];
}

export default function ClubScreen() {
  const { currentMember, setCurrentMember, members, refreshMembers } = useMember();
  const [stats, setStats] = useState<Stats | null>(null);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!currentMember) return;
    const [{ data: ratings }, { data: books }, { count: attended }] = await Promise.all([
      supabase
        .from("ratings")
        .select("book_id, pre_rating, post_rating")
        .eq("member_id", currentMember.id),
      supabase.from("books").select("*"),
      supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("member_id", currentMember.id)
        .eq("status", "going"),
    ]);

    const bookById = new Map((books || []).map((b) => [b.id, b as Book]));
    const scored = (ratings || [])
      .map((r) => ({ book_id: r.book_id, score: r.post_rating ?? r.pre_rating }))
      .filter((r): r is { book_id: string; score: number } => r.score !== null);

    const highest = scored
      .slice()
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((r) => ({ book: bookById.get(r.book_id)!, score: r.score }))
      .filter((r) => r.book);

    setStats({
      read: scored.length,
      avg: scored.length ? scored.reduce((a, b) => a + b.score, 0) / scored.length : null,
      attended: attended || 0,
      highest,
    });
  }, [currentMember]);

  useEffect(() => {
    load();
  }, [load]);

  /** Earliest-joined member gets the founding label. */
  const isFounding = useMemo(() => {
    if (!currentMember || members.length === 0) return false;
    const earliest = members
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    return earliest?.id === currentMember.id;
  }, [currentMember, members]);

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
    if (data) {
      setNewName("");
      setIsAdding(false);
      await refreshMembers();
    }
  }

  if (!currentMember) {
    return <div className="px-5 pt-[62px] text-[13px] text-muted">Pick who you are to see your profile.</div>;
  }

  const joined = new Date(currentMember.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="pt-[62px]">
      <div className="px-5">
        <div className="flex items-center gap-[14px]">
          <Initials name={currentMember.name} size={56} />
          <div className="min-w-0">
            <p className="text-[22px] font-medium tracking-[-0.015em] text-ink">
              {currentMember.name}
            </p>
            <p className="mt-[3px] text-[12.5px] text-muted">
              {isFounding ? "Founding member" : "Member"} · joined {joined}
            </p>
          </div>
        </div>

        <div className="mt-[22px] flex gap-7">
          <Stat label="Read" value={stats ? String(stats.read) : "—"} />
          <Stat
            label="Your average"
            value={stats?.avg != null ? stats.avg.toFixed(1) : "—"}
          />
          <Stat label="Attended" value={stats ? String(stats.attended) : "—"} />
        </div>
      </div>

      <div className="mt-6">
        <Rule />
      </div>

      <section className="px-5 pt-5">
        <Kicker>Your highest</Kicker>
        {!stats || stats.highest.length === 0 ? (
          <p className="py-4 text-[12.5px] text-muted">
            Nothing rated yet. Scores you give show up here.
          </p>
        ) : (
          stats.highest.map((h, i) => (
            <div
              key={h.book.id}
              className={cn(
                "flex items-center justify-between py-3",
                i < stats.highest.length - 1 && "row-line"
              )}
            >
              <span className={cn("text-[14px]", i === 2 ? "text-muted" : "text-ink")}>
                {h.book.title}
              </span>
              <Num
                className={cn("text-[16px] font-semibold", i === 2 ? "text-muted" : "text-green")}
              >
                {h.score.toFixed(1)}
              </Num>
            </div>
          ))
        )}
      </section>

      <div className="mt-6">
        <Rule />
      </div>

      {/* Switching members is not in the design — the club needs it on a shared device. */}
      <section className="px-5 pt-5">
        <Kicker>The club</Kicker>
        <div className="mt-3 flex flex-wrap gap-[10px]">
          {members
            .filter((m) => m.id !== currentMember.id)
            .map((m) => (
              <button
                key={m.id}
                onClick={() => setCurrentMember(m)}
                className="rounded-full border border-tan px-[13px] py-[6px] text-[12.5px] text-muted active:bg-tan/30"
              >
                {m.name}
              </button>
            ))}
        </div>

        <div className="mt-4">
          {!isAdding ? (
            <OutlineButton onClick={() => setIsAdding(true)}>Add a member</OutlineButton>
          ) : (
            <div className="space-y-2">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="Their name"
                autoFocus
                className="w-full rounded-lg border border-tan bg-transparent px-3 py-[9px] text-[14px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
              />
              {error && <p className="text-[12px] text-muted">{error}</p>}
              <div className="flex gap-2">
                <OutlineButton className="flex-1" onClick={() => setIsAdding(false)}>
                  Cancel
                </OutlineButton>
                <SolidButton className="flex-1" onClick={handleAdd}>
                  Add
                </SolidButton>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Num className="text-[22px] font-semibold text-ink">{value}</Num>
      <p className="mt-[5px] text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
    </div>
  );
}
