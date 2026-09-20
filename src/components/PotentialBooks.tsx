"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BookOpen, Check, Plus, ThumbsUp } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Member, Nomination, NominationReaction } from "@/types";
import { fetchVolumeById, getBookCoverUrl, getISBN, searchBooks } from "@/lib/google-books";
import { resolveCoverUrl } from "@/lib/covers";
import { leather } from "@/lib/design";
import BookCover from "./BookCover";
import { Kicker, Num, OutlineButton, Sheet } from "./ui";
import { cn } from "@/lib/utils";

/**
 * Books the club might read next.
 *
 * Covers face out and sit flat — a table of new releases rather than a shelf
 * of spines. Tapping one turns it over to the synopsis; a card that has been
 * turned stays turned while you scroll past it and back.
 */

const CARD_W = 116;
const CARD_H = 174;

export default function PotentialBooks({ currentMember }: { currentMember: Member | null }) {
  const [nominations, setNominations] = useState<Nomination[]>([]);
  const [reactions, setReactions] = useState<NominationReaction[]>([]);
  const [flipped, setFlipped] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const [nomsRes, reactionsRes] = await Promise.all([
      supabase.from("nominations").select("*").order("created_at", { ascending: false }),
      supabase.from("nomination_reactions").select("*, member:members(*)"),
    ]);
    // The table arrives with its migration; treat absence as empty.
    if (nomsRes.error) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setNominations((nomsRes.data as Nomination[]) || []);
    setReactions(reactionsRes.error ? [] : (reactionsRes.data as NominationReaction[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleFlip(id: string) {
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function react(nomination: Nomination, field: "has_read" | "interested") {
    if (!currentMember) return;
    const mine = reactions.find(
      (r) => r.nomination_id === nomination.id && r.member_id === currentMember.id
    );
    const next = { has_read: mine?.has_read ?? false, interested: mine?.interested ?? false };
    next[field] = !next[field];

    setReactions((prev) => [
      ...prev.filter((r) => !(r.nomination_id === nomination.id && r.member_id === currentMember.id)),
      {
        id: mine?.id ?? "tmp",
        nomination_id: nomination.id,
        member_id: currentMember.id,
        member: currentMember,
        ...next,
      },
    ]);

    await supabase
      .from("nomination_reactions")
      .upsert(
        { nomination_id: nomination.id, member_id: currentMember.id, ...next },
        { onConflict: "nomination_id,member_id" }
      );
    load();
  }

  async function remove(id: string) {
    await supabase.from("nominations").delete().eq("id", id);
    load();
  }

  if (missing) {
    return (
      <div>
        <Kicker>Potential Books</Kicker>
        <p className="py-4 text-[12.5px] text-muted">
          Run migration 008 to start collecting nominations.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <Kicker>Potential Books</Kicker>
        {currentMember && (
          <button onClick={() => setAdding(true)} className="text-[11.5px] text-green">
            Nominate One
          </button>
        )}
      </div>

      {nominations.length === 0 ? (
        <p className="py-4 text-[12.5px] text-muted">Nothing put forward yet.</p>
      ) : (
        <div className="scrollbar-hide -mx-5 mt-3 overflow-x-auto overscroll-x-contain px-5">
          <div className="flex w-max gap-4 pb-2" style={{ perspective: "1200px" }}>
            {nominations.map((n) => {
              const mine = currentMember
                ? reactions.find(
                    (r) => r.nomination_id === n.id && r.member_id === currentMember.id
                  )
                : undefined;
              const readCount = reactions.filter((r) => r.nomination_id === n.id && r.has_read).length;
              const keenCount = reactions.filter(
                (r) => r.nomination_id === n.id && r.interested
              ).length;
              const isFlipped = flipped.has(n.id);

              return (
                <div key={n.id} className="flex-none" style={{ width: CARD_W }}>
                  <button
                    onClick={() => toggleFlip(n.id)}
                    className="relative block"
                    style={{
                      width: CARD_W,
                      height: CARD_H,
                      transformStyle: "preserve-3d",
                      transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                      transition: "transform .5s cubic-bezier(.2,.8,.2,1)",
                    }}
                    aria-label={n.title}
                    aria-pressed={isFlipped}
                  >
                    {/* Front — the cover, square on. */}
                    <span
                      className="absolute inset-0 block overflow-hidden rounded-[3px]"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        background: leather(n.title).hex,
                        boxShadow: "0 8px 18px rgba(28,17,8,.26)",
                      }}
                    >
                      <BookCover
                        book={{
                          title: n.title,
                          author: n.author,
                          cover_url: n.cover_url,
                          isbn: n.isbn,
                          google_books_id: n.google_books_id,
                        }}
                        className="h-full w-full"
                        fit="cover"
                      />
                    </span>

                    {/* Back — what it's about, with the title still on it. */}
                    <span
                      className="absolute inset-0 flex flex-col overflow-hidden rounded-[3px] border border-tan bg-ground p-[10px] text-left"
                      style={{
                        backfaceVisibility: "hidden",
                        WebkitBackfaceVisibility: "hidden",
                        transform: "rotateY(180deg)",
                        boxShadow: "0 8px 18px rgba(28,17,8,.2)",
                      }}
                    >
                      <span className="block text-[11.5px] font-medium leading-tight text-ink line-clamp-2">
                        {n.title}
                      </span>
                      {n.author && (
                        <span className="mt-[2px] block truncate text-[10px] text-muted">
                          {n.author}
                        </span>
                      )}
                      <span className="mt-[6px] block flex-1 overflow-hidden text-[9.5px] leading-[1.45] text-muted">
                        {n.synopsis || "No synopsis found."}
                      </span>
                    </span>
                  </button>

                  <p className="mt-2 truncate text-[12px] text-ink">{n.title}</p>
                  {n.author && <p className="truncate text-[10.5px] text-muted">{n.author}</p>}
                  {n.genre && <p className="truncate text-[10px] text-green">{n.genre}</p>}

                  <div className="mt-[6px] flex items-center gap-1">
                    <button
                      onClick={() => react(n, "has_read")}
                      disabled={!currentMember}
                      title="I've read it"
                      className={cn(
                        "flex h-[26px] flex-1 items-center justify-center gap-[3px] rounded border text-[10px] transition-colors",
                        mine?.has_read
                          ? "border-green bg-green text-ground"
                          : "border-tan text-muted active:bg-tan/40"
                      )}
                    >
                      {mine?.has_read ? <Check size={10} weight="bold" /> : <BookOpen size={11} />}
                      <Num>{readCount}</Num>
                    </button>
                    <button
                      onClick={() => react(n, "interested")}
                      disabled={!currentMember}
                      title="I'd read it"
                      className={cn(
                        "flex h-[26px] flex-1 items-center justify-center gap-[3px] rounded border text-[10px] transition-colors",
                        mine?.interested
                          ? "border-green bg-green text-ground"
                          : "border-tan text-muted active:bg-tan/40"
                      )}
                    >
                      <ThumbsUp size={11} weight={mine?.interested ? "fill" : "regular"} />
                      <Num>{keenCount}</Num>
                    </button>
                  </div>

                  {currentMember?.is_admin && (
                    <button
                      onClick={() => remove(n.id)}
                      className="mt-1 w-full text-[10px] text-muted/60"
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {adding && currentMember && (
        <NominateSheet
          memberId={currentMember.id}
          onDone={() => {
            setAdding(false);
            load();
          }}
          onClose={() => setAdding(false)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- nominating */

function NominateSheet({
  memberId,
  onDone,
  onClose,
}: {
  memberId: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Awaited<ReturnType<typeof searchBooks>>>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      setResults(await searchBooks(query));
      setSearching(false);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  async function nominate(id: string) {
    setSaving(id);
    const vol = await fetchVolumeById(id);
    if (!vol) return setSaving(null);

    const title = vol.volumeInfo.title;
    const author = vol.volumeInfo.authors?.join(", ") || null;
    const isbn = getISBN(vol);
    const cover =
      (await resolveCoverUrl({ google_books_id: id, isbn, title, author })) || getBookCoverUrl(vol);

    // Trim the blurb to something that fits the back of a card.
    const raw = (vol.volumeInfo.description || "").replace(/<[^>]*>/g, "").trim();
    const synopsis = raw.length > 320 ? `${raw.slice(0, 317).trimEnd()}…` : raw || null;

    await supabase.from("nominations").insert({
      title,
      author,
      cover_url: cover,
      isbn,
      google_books_id: id,
      synopsis,
      genre: vol.volumeInfo.categories?.[0] ?? null,
      added_by: memberId,
    });
    setSaving(null);
    onDone();
  }

  return (
    <Sheet title="Nominate a Book" onClose={onClose}>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Title or author"
        autoFocus
        autoComplete="off"
        className="w-full border-b border-tan bg-transparent py-2 text-[17px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
      />
      <div className="pt-2">
        {searching && <p className="py-4 text-[12.5px] text-muted">Searching…</p>}
        {results.map((r) => (
          <button
            key={r.id}
            onClick={() => nominate(r.id)}
            disabled={Boolean(saving)}
            className="row-line flex w-full items-center gap-3 py-[11px] text-left"
          >
            <div
              className="h-[42px] w-[28px] flex-none overflow-hidden rounded-sm"
              style={{ background: leather(r.volumeInfo.title).hex }}
            >
              <BookCover
                book={{ title: r.volumeInfo.title, google_books_id: r.id }}
                className="h-full w-full"
                fit="cover"
              />
            </div>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] text-ink">{r.volumeInfo.title}</span>
              <span className="block truncate text-[12px] text-muted">
                {r.volumeInfo.authors?.join(", ")}
              </span>
            </span>
            <span className="flex-none text-[11.5px] text-green">
              {saving === r.id ? "Adding…" : <Plus size={14} />}
            </span>
          </button>
        ))}
      </div>
      <OutlineButton className="mt-4 w-full" onClick={onClose}>
        Done
      </OutlineButton>
    </Sheet>
  );
}
