"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUUpLeft } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { Initials, Kicker, Num, OutlineButton, Rule, Score, SolidButton } from "@/components/ui";
import { getExactPageCount } from "@/lib/utils";
import { leather, scoreColor } from "@/lib/design";
import BookCover from "@/components/BookCover";
import { cn } from "@/lib/utils";

const SORTS = [
  "Score · high to low",
  "Score · low to high",
  "Title A–Z",
  "Recently read",
] as const;
type Sort = (typeof SORTS)[number];

interface Scored {
  book: Book;
  score: number;
}

export default function ClubScreen() {
  const router = useRouter();
  const { currentMember, setCurrentMember, members, refreshMembers } = useMember();

  // Whose profile is on screen. Defaults to you, but any member can be opened.
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [attended, setAttended] = useState(0);
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const viewing = useMemo(
    () => members.find((m) => m.id === viewingId) ?? currentMember,
    [members, viewingId, currentMember]
  );
  const isSelf = viewing?.id === currentMember?.id;

  const load = useCallback(async () => {
    if (!viewing) return;
    const [{ data: booksData }, { data: ratings }, { count }] = await Promise.all([
      supabase.from("books").select("*"),
      supabase
        .from("ratings")
        .select("book_id, pre_rating, post_rating")
        .eq("member_id", viewing.id),
      supabase
        .from("attendance")
        .select("*", { count: "exact", head: true })
        .eq("member_id", viewing.id)
        .eq("status", "going"),
    ]);

    setBooks((booksData || []) as Book[]);
    const map: Record<string, number> = {};
    for (const r of ratings || []) {
      const v = r.post_rating ?? r.pre_rating;
      if (v !== null) map[r.book_id] = v;
    }
    setScores(map);
    setAttended(count || 0);
  }, [viewing]);

  useEffect(() => {
    load();
  }, [load]);

  const scored: Scored[] = useMemo(
    () =>
      books
        .filter((b) => scores[b.id] !== undefined)
        .map((book) => ({ book, score: scores[book.id] })),
    [books, scores]
  );

  const sortedBooks = useMemo(() => {
    const copy = scored.slice();
    switch (sort) {
      case "Score · low to high":
        return copy.sort((a, b) => a.score - b.score);
      case "Title A–Z":
        return copy.sort((a, b) => a.book.title.localeCompare(b.book.title));
      case "Recently read":
        return copy.sort(
          (a, b) =>
            new Date(b.book.completed_at ?? b.book.created_at).getTime() -
            new Date(a.book.completed_at ?? a.book.created_at).getTime()
        );
      default:
        return copy.sort((a, b) => b.score - a.score);
    }
  }, [scored, sort]);

  const average = scored.length
    ? scored.reduce((a, b) => a + b.score, 0) / scored.length
    : null;
  const pagesRead = scored.reduce((sum, s) => sum + (getExactPageCount(s.book) ?? 0), 0);

  const isFounding = useMemo(() => {
    if (!viewing || members.length === 0) return false;
    const earliest = members
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    return earliest?.id === viewing.id;
  }, [viewing, members]);

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

  if (!viewing) {
    return <div className="px-5 pt-[62px] text-[13px] text-muted">Pick who you are first.</div>;
  }

  const joined = new Date(viewing.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div className="pt-[62px]">
      <div className="px-5">
        {!isSelf && (
          <button
            onClick={() => setViewingId(null)}
            className="mb-4 flex items-center gap-[6px] text-[12.5px] text-green"
          >
            <ArrowUUpLeft size={14} />
            Back to your profile
          </button>
        )}

        <div className="flex items-center gap-[14px]">
          <Initials name={viewing.name} size={56} />
          <div className="min-w-0">
            <p className="text-[22px] font-medium tracking-[-0.015em] text-ink">{viewing.name}</p>
            <p className="mt-[3px] text-[12.5px] text-muted">
              {isFounding ? "Founding member" : "Member"} · joined {joined}
            </p>
          </div>
        </div>

        {/* Numbers centred over their labels. */}
        <div className="mt-[22px] grid grid-cols-4 gap-2">
          <Stat label="Read" value={String(scored.length)} />
          <Stat
            label="Average"
            value={average !== null ? average.toFixed(1) : "—"}
            color={scoreColor(average)}
          />
          <Stat label="Attended" value={String(attended)} />
          <Stat label="Pages" value={pagesRead ? pagesRead.toLocaleString() : "—"} />
        </div>
      </div>

      <div className="mt-6">
        <Rule />
      </div>

      <section className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <Kicker>{isSelf ? "Your books" : `${viewing.name.split(" ")[0]}'s books`}</Kicker>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="control rounded-lg border border-tan bg-transparent py-[5px] pl-[9px] pr-[26px] text-[11px] font-medium text-ink outline-none"
          >
            {SORTS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>

        {sortedBooks.length === 0 ? (
          <p className="py-4 text-[12.5px] text-muted">Nothing scored yet.</p>
        ) : (
          <div className="mt-2">
            {sortedBooks.map(({ book, score }, i) => (
              <button
                key={book.id}
                onClick={() => router.push(`/book/${book.id}`)}
                className={cn(
                  "flex w-full items-center gap-3 py-[10px] text-left",
                  i < sortedBooks.length - 1 && "row-line"
                )}
              >
                <div
                  className="h-[40px] w-[27px] flex-none overflow-hidden rounded-sm"
                  style={{ background: leather(book.title).hex }}
                >
                  <BookCover book={book} className="h-full w-full" fit="cover" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] text-ink">{book.title}</span>
                  <span className="block truncate text-[11.5px] text-muted">{book.author}</span>
                </span>
                <Score value={score} size={16} />
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6">
        <Rule />
      </div>

      <section className="px-5 pt-5">
        <Kicker>The club</Kicker>
        <div className="mt-3 flex flex-wrap gap-[10px]">
          {members.map((m: Member) => {
            const active = m.id === viewing.id;
            return (
              <button
                key={m.id}
                onClick={() => setViewingId(m.id)}
                className={cn(
                  "rounded-full border px-[13px] py-[6px] text-[12.5px] transition-colors",
                  active
                    ? "border-green bg-green text-ground"
                    : "border-tan text-muted active:bg-tan/40"
                )}
              >
                {m.name}
              </button>
            );
          })}
        </div>

        {viewing.id !== currentMember?.id && (
          <OutlineButton
            className="mt-4 w-full"
            onClick={() => {
              setCurrentMember(viewing);
              setViewingId(null);
            }}
          >
            Switch to {viewing.name.split(" ")[0]}
          </OutlineButton>
        )}

        <div className="mt-3">
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

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <Num className="block text-[21px] font-semibold leading-none" style={undefined}>
        <span style={{ color: color ?? "#0e5f49" }}>{value}</span>
      </Num>
      <p className="mt-[6px] text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
