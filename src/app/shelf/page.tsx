"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Book, Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookSearch from "@/components/BookSearch";
import BookCover from "@/components/BookCover";
import { Kicker, Num, ScreenTitle } from "@/components/ui";
import {
  isDarkSpine,
  shortMonthYear,
  spineColor,
  spineHeight,
  spineTextColor,
  spineWidth,
} from "@/lib/design";
import { cn } from "@/lib/utils";

const SORTS = [
  "Score · high to low",
  "Score · low to high",
  "Title A–Z",
  "Recently read",
] as const;
type Sort = (typeof SORTS)[number];

interface ShelfBook extends Book {
  avg: number | null;
}

export default function ShelfScreen() {
  const { currentMember, members } = useMember();
  const [books, setBooks] = useState<ShelfBook[]>([]);
  const [memberStats, setMemberStats] = useState<Record<string, { books: number; avg: number | null }>>({});
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [selected, setSelected] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: booksData }, { data: ratingsData }] = await Promise.all([
      supabase.from("books").select("*").eq("status", "completed"),
      supabase.from("ratings").select("book_id, member_id, pre_rating, post_rating"),
    ]);

    const rows = (booksData || []) as Book[];
    const ratings = ratingsData || [];

    const byBook = new Map<string, number[]>();
    const byMember = new Map<string, number[]>();
    for (const r of ratings) {
      const v = r.post_rating ?? r.pre_rating;
      if (v === null) continue;
      byBook.set(r.book_id, [...(byBook.get(r.book_id) || []), v]);
      byMember.set(r.member_id, [...(byMember.get(r.member_id) || []), v]);
    }
    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

    setBooks(
      rows.map((b) => {
        const vals = byBook.get(b.id);
        return { ...b, avg: vals && vals.length ? mean(vals) : null };
      })
    );

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
    const copy = books.slice();
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
  }, [books, sort]);

  const sel = sorted[Math.min(selected, sorted.length - 1)] ?? null;

  return (
    <div className="pt-[58px]">
      <div className="flex items-baseline justify-between px-5 pb-1">
        <ScreenTitle>Shelf</ScreenTitle>
        <span className="text-[11.5px] text-muted">
          <Num>{books.length}</Num> books read
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
          <button
            onClick={() => setShowSearch(true)}
            aria-label="Add a book"
            className="flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-tan text-ink active:bg-tan/30"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeWidth={2.4} d="M12 5v14M5 12h14" />
            </svg>
          </button>
        )}
      </div>

      {/* The shelf */}
      {loading ? (
        <div className="mx-5 mt-[22px] h-[150px] animate-pulse rounded bg-tan/40" />
      ) : sorted.length === 0 ? (
        <p className="px-5 pt-6 text-[13px] leading-relaxed text-muted">
          No finished books yet. When the club finishes one it lands here, best first.
        </p>
      ) : (
        <>
          <div className="scrollbar-hide overflow-x-auto px-5 pt-[22px]">
            <div className="flex w-max items-end gap-[6px]" style={{ perspective: "800px" }}>
              {sorted.map((b, i) => {
                const on = i === selected;
                const color = spineColor(b.title);
                const w = spineWidth(b.title);
                const h = spineHeight(b.title);
                const dark = isDarkSpine(color);
                return (
                  <div key={b.id} className="flex flex-none flex-col items-center gap-[7px]">
                    {on ? (
                      <button
                        onClick={() => setSelected(i)}
                        className="cover-lift relative flex-none overflow-hidden"
                        style={{
                          width: 96,
                          height: h + 10,
                          borderRadius: "2px 5px 5px 2px",
                          background: color,
                          transform: "perspective(600px) rotateY(-26deg)",
                          transformOrigin: "left center",
                          marginRight: -6,
                          transition: "transform .22s ease, width .22s ease",
                        }}
                        aria-label={b.title}
                      >
                        <BookCover book={b} className="h-full w-full" fit="cover" />
                        <span
                          className="num absolute bottom-[7px] right-[7px] rounded-md px-[7px] py-[3px] text-[13px] font-semibold text-ink"
                          style={{ background: "#fff5e7" }}
                        >
                          {b.avg !== null ? b.avg.toFixed(1) : "—"}
                        </span>
                      </button>
                    ) : (
                      <button
                        onClick={() => setSelected(i)}
                        className="spine-title flex-none px-0 py-[9px]"
                        style={{
                          width: w,
                          height: h,
                          borderRadius: "1px 3px 3px 1px",
                          background: color,
                          color: spineTextColor(color),
                          fontSize: w > 26 ? 10.5 : 9.5,
                          letterSpacing: ".02em",
                          transition: "width .22s ease",
                        }}
                        title={b.title}
                      >
                        {b.title}
                      </button>
                    )}
                    <Num
                      className={cn(
                        "text-[11px]",
                        on ? "font-semibold text-ink" : "font-medium text-muted"
                      )}
                    >
                      {b.avg !== null ? b.avg.toFixed(1) : "—"}
                    </Num>
                    {dark && null}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shelf line */}
          <div className="mx-5 mt-2 h-[3px] rounded-sm bg-tan" />

          {/* Selected caption */}
          {sel && (
            <Link href={`/book/${sel.id}`} className="block px-5 pt-4">
              <p className="text-[22px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">
                {sel.title}
              </p>
              <p className="mt-[5px] text-[13px] text-muted">
                {sel.author}
                {shortMonthYear(sel.completed_at) ? ` · read ${shortMonthYear(sel.completed_at)}` : ""}
              </p>
            </Link>
          )}
        </>
      )}

      <div className="mt-[22px]">
        <div className="rule" />
      </div>

      {/* Members table */}
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
