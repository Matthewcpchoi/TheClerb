"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookSearch from "@/components/BookSearch";
import BookCover from "@/components/BookCover";
import ShelfWheel from "@/components/ShelfWheel";
import { Kicker, Num, OutlineButton, Rule, ScreenTitle } from "@/components/ui";
import { markCompleted } from "@/lib/books";
import { shortMonthYear, spineColor } from "@/lib/design";

const SORTS = [
  "Score · high to low",
  "Score · low to high",
  "Title A–Z",
  "Recently read",
] as const;
type Sort = (typeof SORTS)[number];

interface ShelfBook extends Book {
  avg: number | null;
  scores: number;
  notes: number;
}

export default function ShelfScreen() {
  const router = useRouter();
  const { currentMember, members } = useMember();
  const [shelf, setShelf] = useState<ShelfBook[]>([]);
  const [upNext, setUpNext] = useState<Book[]>([]);
  const [memberStats, setMemberStats] = useState<Record<string, { books: number; avg: number | null }>>({});
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [selected, setSelected] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: booksData }, { data: ratingsData }, commentsRes] = await Promise.all([
      supabase.from("books").select("*"),
      supabase.from("ratings").select("book_id, member_id, pre_rating, post_rating"),
      supabase.from("book_comments").select("book_id"),
    ]);

    const all = (booksData || []) as Book[];
    const ratings = ratingsData || [];
    const comments = commentsRes.error ? [] : commentsRes.data || [];

    const byBook = new Map<string, number[]>();
    const byMember = new Map<string, number[]>();
    for (const r of ratings) {
      const v = r.post_rating ?? r.pre_rating;
      if (v === null) continue;
      byBook.set(r.book_id, [...(byBook.get(r.book_id) || []), v]);
      byMember.set(r.member_id, [...(byMember.get(r.member_id) || []), v]);
    }
    const noteCount = new Map<string, number>();
    for (const c of comments) noteCount.set(c.book_id, (noteCount.get(c.book_id) || 0) + 1);
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

    setShelf(
      all
        .filter((b) => b.status === "completed")
        .map((b) => {
          const vals = byBook.get(b.id) || [];
          return {
            ...b,
            avg: vals.length ? mean(vals) : null,
            scores: vals.length,
            notes: noteCount.get(b.id) || 0,
          };
        })
    );
    setUpNext(all.filter((b) => b.status === "upcoming"));

    const stats: Record<string, { books: number; avg: number | null }> = {};
    byMember.forEach((vals, memberId) => {
      stats[memberId] = { books: vals.length, avg: vals.length ? mean(vals) : null };
    });
    setMemberStats(stats);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const sorted = useMemo(() => {
    const copy = shelf.slice();
    switch (sort) {
      case "Score · low to high":
        return copy.sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));
      case "Title A–Z":
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case "Recently read":
        return copy.sort(
          (a, b) =>
            new Date(b.completed_at ?? b.created_at).getTime() -
            new Date(a.completed_at ?? a.created_at).getTime()
        );
      default:
        return copy.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
    }
  }, [shelf, sort]);

  const sel = sorted[Math.min(selected, sorted.length - 1)] ?? null;

  async function startReading(bookId: string) {
    setStarting(bookId);
    const currentlyReading = [...shelf, ...upNext].find((b) => b.status === "reading");
    if (currentlyReading) await markCompleted(currentlyReading.id);
    await supabase.from("books").update({ status: "reading" }).eq("id", bookId);
    setStarting(null);
    router.push("/");
  }

  return (
    <div className="pt-[58px]">
      <div className="flex items-baseline justify-between px-5 pb-1">
        <ScreenTitle>Shelf</ScreenTitle>
        <span className="text-[11.5px] text-muted">
          <Num>{shelf.length}</Num> books read
        </span>
      </div>

      <div className="flex items-center gap-2 px-5 pt-[10px]">
        <select
          value={sort}
          onChange={(e) => {
            setSort(e.target.value as Sort);
            setSelected(0);
          }}
          className="control rounded-lg border border-tan bg-transparent py-[7px] pl-[11px] pr-[30px] text-[11.5px] font-medium text-ink outline-none"
        >
          {SORTS.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="flex-1" />
        {currentMember && (
          <OutlineButton className="px-3 py-[6px] text-[12px]" onClick={() => setShowSearch(true)}>
            Add a book
          </OutlineButton>
        )}
      </div>

      {loading ? (
        <div className="mx-5 mt-[22px] h-[150px] animate-pulse rounded bg-tan/40" />
      ) : sorted.length === 0 ? (
        <p className="px-5 pt-6 text-[13px] leading-relaxed text-muted">
          No finished books yet. Books the club finishes land here, best first.
        </p>
      ) : (
        <div className="mt-[22px]">
          <ShelfWheel books={sorted} selected={selected} onSelect={setSelected} />
        </div>
      )}

      {/* Caption — a row that reads as a way in, with what's waiting inside. */}
      {sel && (
        <button
          onClick={() => router.push(`/book/${sel.id}`)}
          className="row-line mt-4 flex w-full items-center gap-3 px-5 pb-4 text-left active:bg-tan/20"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">
              {sel.title}
            </p>
            <p className="mt-[5px] text-[13px] text-muted">
              {sel.author}
              {shortMonthYear(sel.completed_at) ? ` · read ${shortMonthYear(sel.completed_at)}` : ""}
            </p>
            <p className="mt-[7px] text-[11.5px] text-green">
              <Num>{sel.scores}</Num> score{sel.scores === 1 ? "" : "s"}
              {sel.notes > 0 && (
                <>
                  {" · "}
                  <Num>{sel.notes}</Num> note{sel.notes === 1 ? "" : "s"}
                </>
              )}
              {" · discussion"}
            </p>
          </div>
          <CaretRight size={18} className="flex-none text-green" />
        </button>
      )}

      {/* Where a just-added book goes, and how it becomes the current read. */}
      {upNext.length > 0 && (
        <section className="px-5 pt-5">
          <Kicker>Up next</Kicker>
          <div className="mt-2">
            {upNext.map((b) => (
              <div key={b.id} className="row-line flex items-center gap-3 py-[11px]">
                <div
                  className="h-[46px] w-[31px] flex-none overflow-hidden"
                  style={{ borderRadius: "1px 3px 3px 1px", background: spineColor(b.title) }}
                >
                  <BookCover book={b} className="h-full w-full" fit="cover" />
                </div>
                <button
                  onClick={() => router.push(`/book/${b.id}`)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate text-[14.5px] text-ink">{b.title}</p>
                  <p className="truncate text-[12px] text-muted">{b.author}</p>
                </button>
                {currentMember && (
                  <OutlineButton
                    className="flex-none px-3 py-[6px] text-[12px]"
                    disabled={starting === b.id}
                    onClick={() => startReading(b.id)}
                  >
                    {starting === b.id ? "Starting…" : "Start reading"}
                  </OutlineButton>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-[22px]">
        <Rule />
      </div>

      <section className="px-5 pt-[18px]">
        <div className="flex items-baseline justify-between">
          <Kicker>Members</Kicker>
          <span className="flex gap-[26px]">
            <Kicker>Read</Kicker>
            <Kicker>Avg</Kicker>
          </span>
        </div>
        <div className="mt-[10px]">
          {members.map((m: Member) => {
            const s = memberStats[m.id];
            return (
              <div key={m.id} className="row-line flex items-center py-[11px]">
                <span className="text-[14.5px] text-ink">{m.name}</span>
                <span className="flex-1" />
                <Num className="w-[42px] text-right text-[14px] font-medium text-muted">
                  {s?.books ?? 0}
                </Num>
                <Num className="w-[52px] text-right text-[14px] font-semibold text-ink">
                  {s?.avg != null ? s.avg.toFixed(1) : "—"}
                </Num>
              </div>
            );
          })}
        </div>
      </section>

      {showSearch && currentMember && (
        <BookSearch
          memberId={currentMember.id}
          onBookAdded={() => {
            setShowSearch(false);
            load();
          }}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
