"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUUpLeft, PencilSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import {
  DeleteButton,
  Initials,
  Kicker,
  Num,
  OutlineButton,
  Rule,
  Score,
  SolidButton,
} from "@/components/ui";
import BookCover from "@/components/BookCover";
import { getExactPageCount, cn } from "@/lib/utils";
import { leather, scoreColor } from "@/lib/design";

const SORTS = [
  "Score · High to Low",
  "Score · Low to High",
  "Title A–Z",
  "Recently Read",
] as const;
type Sort = (typeof SORTS)[number];

export default function ClubScreen() {
  const router = useRouter();
  const { currentMember, setCurrentMember, members, refreshMembers } = useMember();

  const [viewingId, setViewingId] = useState<string | null>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [attended, setAttended] = useState(0);
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [error, setError] = useState("");

  const viewing = useMemo(
    () => members.find((m) => m.id === viewingId) ?? currentMember,
    [members, viewingId, currentMember]
  );
  const isSelf = viewing?.id === currentMember?.id;
  // Managing the roster and switching whose profile is active is the
  // organiser's job; everyone else can still read any profile.
  const isAdmin = Boolean(currentMember?.is_admin);

  const load = useCallback(async () => {
    if (!viewing) return;
    const [{ data: booksData }, { data: ratings }, { count }] = await Promise.all([
      supabase.from("books").select("*"),
      supabase.from("ratings").select("book_id, pre_rating, post_rating").eq("member_id", viewing.id),
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

  useEffect(() => {
    if (viewing) setNameDraft(viewing.name);
  }, [viewing]);

  const scored = useMemo(
    () =>
      books
        .filter((b) => scores[b.id] !== undefined)
        .map((book) => ({ book, score: scores[book.id] })),
    [books, scores]
  );

  const sortedBooks = useMemo(() => {
    const copy = scored.slice();
    switch (sort) {
      case "Score · Low to High":
        return copy.sort((a, b) => a.score - b.score);
      case "Title A–Z":
        return copy.sort((a, b) => a.book.title.localeCompare(b.book.title));
      case "Recently Read":
        return copy.sort(
          (a, b) =>
            new Date(b.book.completed_at ?? b.book.created_at).getTime() -
            new Date(a.book.completed_at ?? a.book.created_at).getTime()
        );
      default:
        return copy.sort((a, b) => b.score - a.score);
    }
  }, [scored, sort]);

  const average = scored.length ? scored.reduce((a, b) => a + b.score, 0) / scored.length : null;
  const pagesRead = scored.reduce((sum, s) => sum + (getExactPageCount(s.book) ?? 0), 0);

  const isFounding = useMemo(() => {
    if (!viewing || members.length === 0) return false;
    const earliest = members
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())[0];
    return earliest?.id === viewing.id;
  }, [viewing, members]);

  async function saveName() {
    if (!viewing || !nameDraft.trim()) return;
    setError("");
    const { error: err } = await supabase
      .from("members")
      .update({ name: nameDraft.trim() })
      .eq("id", viewing.id);
    if (err) {
      setError(err.code === "23505" ? "That name is taken." : "Couldn't save that.");
      return;
    }
    setEditingName(false);
    await refreshMembers();
    if (viewing.id === currentMember?.id) {
      setCurrentMember({ ...viewing, name: nameDraft.trim() });
    }
  }

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

  async function removeMember(m: Member) {
    if (!confirm(`Remove ${m.name} from the club?`)) return;
    await supabase.from("members").delete().eq("id", m.id);
    if (viewingId === m.id) setViewingId(null);
    await refreshMembers();
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
            Back to Your Profile
          </button>
        )}

        <div className="flex items-center gap-[14px]">
          <Initials name={viewing.name} size={56} />
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="space-y-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveName()}
                  autoFocus
                  className="w-full rounded-lg border border-tan bg-transparent px-3 py-[7px] text-[18px] text-ink outline-none focus:border-green"
                />
                <div className="flex gap-2">
                  <OutlineButton
                    className="px-3 py-[5px] text-[12px]"
                    onClick={() => {
                      setEditingName(false);
                      setNameDraft(viewing.name);
                      setError("");
                    }}
                  >
                    Cancel
                  </OutlineButton>
                  <SolidButton className="px-3 py-[5px] text-[12px]" onClick={saveName}>
                    Save
                  </SolidButton>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <p className="truncate text-[22px] font-medium tracking-[-0.015em] text-ink">
                    {viewing.name}
                  </p>
                  {(isSelf || isAdmin) && (
                    <button
                      onClick={() => setEditingName(true)}
                      aria-label="Edit name"
                      className="flex-none text-green"
                    >
                      <PencilSimple size={14} />
                    </button>
                  )}
                </div>
                <p className="mt-[3px] text-[12.5px] text-muted">
                  {viewing.is_admin ? "Organiser" : isFounding ? "Founding Member" : "Member"} ·
                  joined {joined}
                </p>
              </>
            )}
          </div>
        </div>

        {error && <p className="mt-2 text-[12px] text-muted">{error}</p>}

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
          <Kicker>{isSelf ? "Your Books" : `${viewing.name.split(" ")[0]}'s Books`}</Kicker>
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
                onClick={() => router.push(`/book/${book.id}?view=club`)}
                className={cn(
                  "flex w-full items-center gap-3 py-[10px] text-left",
                  i < sortedBooks.length - 1 && "row-line"
                )}
              >
                <div
                  className="h-[40px] w-[27px] flex-none overflow-hidden rounded-sm"
                  style={{ background: book.spine_color || leather(book.title).hex }}
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
        <Kicker>The Club</Kicker>
        <div className="mt-2">
          {members.map((m: Member, i) => {
            const active = m.id === viewing.id;
            return (
              <div
                key={m.id}
                className={cn("flex items-center gap-3 py-[10px]", i < members.length - 1 && "row-line")}
              >
                <button onClick={() => setViewingId(m.id)} className="min-w-0 flex-1 text-left">
                  <span className={cn("text-[14.5px]", active ? "text-ink" : "text-muted")}>
                    {m.name}
                  </span>
                  {m.is_admin && <span className="ml-2 text-[11px] text-green">Organiser</span>}
                </button>
                {isAdmin && m.id !== currentMember?.id && (
                  <>
                    <button
                      onClick={() => {
                        // Switching means acting as someone else; worth a beat.
                        if (confirm(`Use the app as ${m.name}?`)) setCurrentMember(m);
                      }}
                      className="flex-none text-[11.5px] text-green"
                    >
                      Switch
                    </button>
                    <DeleteButton onDelete={() => removeMember(m)} label={`Remove ${m.name}`} />
                  </>
                )}
              </div>
            );
          })}
        </div>

        {isAdmin && (
          <div className="mt-4">
            {!isAdding ? (
              <OutlineButton onClick={() => setIsAdding(true)}>Add a Member</OutlineButton>
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
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="text-center">
      <Num className="block text-[21px] font-semibold leading-none" style={{ color: color ?? "#0e5f49" }}>
        {value}
      </Num>
      <p className="mt-[6px] text-[10.5px] text-muted">{label}</p>
    </div>
  );
}
