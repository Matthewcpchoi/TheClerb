"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CaretRight, CaretUpDown, SquaresFour } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { Book, Member, ProgressStatus } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookSearch from "@/components/BookSearch";
import BookCover from "@/components/BookCover";
import ShelfWheel from "@/components/ShelfWheel";
import { Kicker, Num, OutlineButton, Rule, Score, ScreenTitle, Sheet } from "@/components/ui";
import { syncBookStatuses } from "@/lib/books";
import { extractSpineColor, isDerived, leather, scoreColor, shortMonthYear } from "@/lib/design";
import { cn } from "@/lib/utils";

const SORTS = [
  "Score · High To Low",
  "Score · Low To High",
  "Title A–Z",
  "Recently Read",
] as const;
type Sort = (typeof SORTS)[number];

interface ShelfBook extends Book {
  avg: number | null;
}

/** A hairline instead of a dot between facts. */
function Sep() {
  return <span className="mx-[9px] inline-block h-[10px] w-px translate-y-[1px] bg-tan" />;
}

export default function ShelfScreen() {
  const router = useRouter();
  const { currentMember, members } = useMember();
  const [shelf, setShelf] = useState<ShelfBook[]>([]);
  const [upNext, setUpNext] = useState<Book[]>([]);
  const [scores, setScores] = useState<Record<string, Record<string, number>>>({});
  const [progress, setProgress] = useState<Record<string, Record<string, ProgressStatus>>>({});
  const [sort, setSort] = useState<Sort>(SORTS[0]);
  const [selected, setSelected] = useState(0);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [{ data: booksData }, { data: ratingsData }, { data: progressData }] = await Promise.all([
      supabase.from("books").select("*"),
      supabase.from("ratings").select("book_id, member_id, pre_rating, post_rating"),
      supabase.from("book_progress").select("book_id, member_id, status"),
    ]);

    const all = (booksData || []) as Book[];
    const byBook = new Map<string, number[]>();
    const byMember: Record<string, Record<string, number>> = {};

    for (const r of ratingsData || []) {
      const v = r.post_rating ?? r.pre_rating;
      if (v === null) continue;
      byBook.set(r.book_id, [...(byBook.get(r.book_id) || []), v]);
      (byMember[r.member_id] ||= {})[r.book_id] = v;
    }

    const byProgress: Record<string, Record<string, ProgressStatus>> = {};
    for (const p of progressData || []) (byProgress[p.member_id] ||= {})[p.book_id] = p.status;

    const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;
    setShelf(
      all
        .filter((b) => b.status === "completed")
        .map((b) => {
          const vals = byBook.get(b.id) || [];
          return { ...b, avg: vals.length ? mean(vals) : null };
        })
    );
    setUpNext(all.filter((b) => b.status === "upcoming"));
    setScores(byMember);
    setProgress(byProgress);
    setLoading(false);
    return all;
  }, []);

  useEffect(() => {
    (async () => {
      // Status follows the calendar; correct it before drawing the shelf.
      if (await syncBookStatuses()) await load();
      else await load();
    })();
  }, [load]);

  // Give each book its own binding colour, taken from its cover art. Runs
  // once per book: a derived colour is never one of the fallback leathers.
  useEffect(() => {
    if (loading) return;
    let cancelled = false;
    (async () => {
      const pending = [...shelf, ...upNext].filter((b) => !isDerived(b.spine_color));
      for (const b of pending) {
        if (cancelled) return;
        const hex = await extractSpineColor(b);
        if (!hex || cancelled) continue;
        await supabase.from("books").update({ spine_color: hex }).eq("id", b.id);
        setShelf((prev) => prev.map((x) => (x.id === b.id ? { ...x, spine_color: hex } : x)));
        setUpNext((prev) => prev.map((x) => (x.id === b.id ? { ...x, spine_color: hex } : x)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const sorted = useMemo(() => {
    const copy = shelf.slice();
    switch (sort) {
      case "Score · Low To High":
        return copy.sort((a, b) => (a.avg ?? 99) - (b.avg ?? 99));
      case "Title A–Z":
        return copy.sort((a, b) => a.title.localeCompare(b.title));
      case "Recently Read":
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

  function standing(memberId: string, bookId: string) {
    const score = scores[memberId]?.[bookId] ?? null;
    const status = progress[memberId]?.[bookId] ?? (score !== null ? "finished" : "none");
    const label =
      status === "dnf" ? "DNF" : status === "finished" || score !== null ? "Read" : "Didn't Read";
    return { score, status, label };
  }

  return (
    <div className="pt-[58px]">
      <div className="flex items-baseline justify-between px-5 pb-1">
        <ScreenTitle>Shelf</ScreenTitle>
        <span className="text-[11.5px] text-muted">
          <Num>{shelf.length}</Num> Books Read
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
        <button
          onClick={() => setShowAll(true)}
          aria-label="See every book"
          className="flex h-[32px] w-[32px] items-center justify-center rounded-lg border border-tan text-ink active:bg-tan/40"
        >
          <SquaresFour size={15} />
        </button>
        {currentMember && (
          <OutlineButton className="px-3 py-[6px] text-[12px]" onClick={() => setShowSearch(true)}>
            Add
          </OutlineButton>
        )}
      </div>

      {loading ? (
        <div className="mx-5 mt-[22px] h-[156px] animate-pulse rounded bg-tan/40" />
      ) : sorted.length === 0 ? (
        <p className="px-5 pt-6 text-[13px] leading-relaxed text-muted">No finished books yet.</p>
      ) : (
        <div className="mt-[22px]">
          <ShelfWheel books={sorted} selected={selected} onSelect={setSelected} />
        </div>
      )}

      {sel && (
        <button
          onClick={() => router.push(`/book/${sel.id}?view=club`)}
          className="row-line mt-4 flex w-full items-center gap-3 px-5 pb-4 text-left active:bg-tan/20"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[22px] font-medium leading-[1.15] tracking-[-0.02em] text-ink">
              {sel.title}
            </p>
            <p className="mt-[5px] flex items-center text-[13px] text-muted">
              <span className="truncate">{sel.author}</span>
              {shortMonthYear(sel.completed_at) && (
                <>
                  <Sep />
                  <span className="flex-none">Read {shortMonthYear(sel.completed_at)}</span>
                </>
              )}
            </p>
            <p className="mt-[7px] text-[11.5px] text-green">Reviews, Quotes &amp; Discussion</p>
          </div>
          <CaretRight size={18} className="flex-none text-green" />
        </button>
      )}

      {upNext.length > 0 && (
        <section className="px-5 pt-5">
          <div className="flex items-baseline justify-between">
            <Kicker>Up Next</Kicker>
            <button
              onClick={() => router.push("/calendar")}
              className="text-[11px] text-green"
            >
              Schedule One
            </button>
          </div>
          <div className="mt-2">
            {upNext.map((b) => (
              <button
                key={b.id}
                onClick={() => router.push(`/book/${b.id}?view=club`)}
                className="row-line flex w-full items-center gap-3 py-[11px] text-left"
              >
                <div
                  className="h-[46px] w-[31px] flex-none overflow-hidden rounded-sm"
                  style={{ background: b.spine_color || leather(b.title).hex }}
                >
                  <BookCover book={b} className="h-full w-full" fit="cover" />
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] text-ink">{b.title}</span>
                  <span className="block truncate text-[12px] text-muted">{b.author}</span>
                </span>
                <CaretRight size={14} className="flex-none text-muted/50" />
              </button>
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
          {sel && <span className="truncate pl-3 text-[11px] text-muted">On {sel.title}</span>}
        </div>

        <div className="mt-[10px]">
          {members.map((m: Member) => {
            const stand = sel ? standing(m.id, sel.id) : null;
            const mine = scores[m.id] || {};
            const all = Object.values(mine);
            const avg = all.length ? all.reduce((a, b) => a + b, 0) / all.length : null;
            const open = expandedMember === m.id;

            return (
              <div key={m.id} className="row-line">
                <button
                  onClick={() => setExpandedMember(open ? null : m.id)}
                  className="flex w-full items-center gap-3 py-[11px] text-left"
                  aria-expanded={open}
                >
                  <span className="text-[14.5px] text-ink">{m.name}</span>
                  <span className="flex-1" />
                  {stand && (
                    <span
                      className={cn(
                        "text-[11.5px] text-muted",
                        stand.status === "dnf" && "line-through"
                      )}
                    >
                      {stand.label}
                    </span>
                  )}
                  <span className="w-[46px] text-right">
                    {stand?.score != null ? (
                      <Score value={stand.score} size={15} />
                    ) : (
                      <span className="text-[14px] text-muted/50">—</span>
                    )}
                  </span>
                  <CaretUpDown size={13} className="flex-none text-muted/60" />
                </button>

                {open && (
                  <div className="pop-in pb-3">
                    <p className="pb-2 text-[11.5px] text-muted">
                      <Num>{all.length}</Num> Scored
                      <Sep />
                      Average{" "}
                      <Num style={{ color: scoreColor(avg) }}>
                        {avg !== null ? avg.toFixed(1) : "—"}
                      </Num>
                    </p>
                    <div className="scrollbar-hide max-h-[200px] overflow-y-auto overscroll-contain rounded-lg bg-tan/20 px-3">
                      {shelf
                        .filter((b) => mine[b.id] !== undefined)
                        .sort((a, b) => mine[b.id] - mine[a.id])
                        .map((b, i, arr) => (
                          <button
                            key={b.id}
                            onClick={() => router.push(`/book/${b.id}?view=club`)}
                            className={cn(
                              "flex w-full items-center gap-3 py-[9px] text-left",
                              i < arr.length - 1 && "row-line"
                            )}
                          >
                            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                              {b.title}
                            </span>
                            <Score value={mine[b.id]} size={14} />
                          </button>
                        ))}
                      {all.length === 0 && (
                        <p className="py-3 text-[12.5px] text-muted">Nothing scored yet.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {showAll && (
        <Sheet title="Every Book" onClose={() => setShowAll(false)} full>
          <div className="grid grid-cols-3 gap-x-4 gap-y-5 pt-1">
            {sorted.map((b) => (
              <button
                key={b.id}
                onClick={() => {
                  setShowAll(false);
                  router.push(`/book/${b.id}?view=club`);
                }}
                className="text-left"
              >
                <div
                  className="relative aspect-[2/3] w-full overflow-hidden rounded-sm"
                  style={{
                    background: b.spine_color || leather(b.title).hex,
                    boxShadow: "0 6px 14px rgba(28,17,8,.22)",
                  }}
                >
                  <BookCover book={b} className="h-full w-full" fit="cover" />
                  <span
                    className="num absolute bottom-1 right-1 rounded px-[5px] py-[2px] text-[11px] font-semibold"
                    style={{ background: "#fff5e7", color: scoreColor(b.avg) }}
                  >
                    {b.avg !== null ? b.avg.toFixed(1) : "—"}
                  </span>
                </div>
                <p className="mt-[6px] line-clamp-2 text-[11.5px] leading-tight text-ink">
                  {b.title}
                </p>
              </button>
            ))}
          </div>
          {sorted.length === 0 && <p className="py-6 text-[13px] text-muted">No finished books yet.</p>}
        </Sheet>
      )}

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
