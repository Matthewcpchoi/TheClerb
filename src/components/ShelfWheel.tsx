"use client";

import { useCallback, useEffect, useRef } from "react";
import { Book } from "@/types";
import BookCover from "./BookCover";
import { Num } from "./ui";
import { isDarkSpine, spineColor, spineHeight, spineTextColor, spineWidth } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * The shelf reads like the number wheel on a clock app: the cover frame is
 * fixed and the books travel behind it. Whichever book comes to rest under
 * the frame is the selected one, and its cover fills the frame — so scrolling
 * back through what the club has read never moves the thing you are looking at.
 */

const FRAME_W = 96;
const FRAME_H = 158;
const SCORE_ROW = 22; // score line below the shelf, matching the design
const SHELF_LINE = 3;
const HEIGHT = FRAME_H + SCORE_ROW;

interface ShelfWheelProps {
  books: (Book & { avg: number | null })[];
  selected: number;
  onSelect: (index: number) => void;
}

export default function ShelfWheel({ books, selected, onSelect }: ShelfWheelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const raf = useRef<number | null>(null);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;

  const centerOn = useCallback((index: number, behavior: ScrollBehavior) => {
    const el = scroller.current;
    const item = items.current[index];
    if (!el || !item) return;
    el.scrollTo({
      left: item.offsetLeft + item.offsetWidth / 2 - el.clientWidth / 2,
      behavior,
    });
  }, []);

  /** Whichever spine is nearest the frame wins. */
  const handleScroll = useCallback(() => {
    if (raf.current !== null) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = null;
      const el = scroller.current;
      if (!el) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let best = 0;
      let bestDistance = Infinity;
      items.current.forEach((item, i) => {
        if (!item) return;
        const distance = Math.abs(item.offsetLeft + item.offsetWidth / 2 - center);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = i;
        }
      });
      if (best !== selectedRef.current) onSelect(best);
    });
  }, [onSelect]);

  // Re-centre when the list itself changes (a new sort order, say).
  useEffect(() => {
    centerOn(selectedRef.current, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, centerOn]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  const current = books[selected];

  return (
    <div className="relative select-none" style={{ height: HEIGHT }}>
      {/* The shelf the books stand on — fixed, like the frame. */}
      <div
        className="pointer-events-none absolute inset-x-5 rounded-sm bg-tan"
        style={{ bottom: SCORE_ROW - SHELF_LINE, height: SHELF_LINE }}
      />

      {/* Books travel behind the frame. Edges fade so the row reads as a wheel. */}
      <div
        ref={scroller}
        onScroll={handleScroll}
        className="scrollbar-hide absolute inset-0 overflow-x-auto overflow-y-hidden"
        style={{
          scrollSnapType: "x mandatory",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 44px, #000 calc(100% - 44px), transparent)",
          maskImage:
            "linear-gradient(90deg, transparent, #000 44px, #000 calc(100% - 44px), transparent)",
        }}
      >
        <div className="flex h-full items-end gap-[6px]" style={{ padding: "0 50%" }}>
          {books.map((b, i) => {
            const color = spineColor(b.title);
            const w = spineWidth(b.title);
            const h = spineHeight(b.title);
            const isSelected = i === selected;
            return (
              <div
                key={b.id}
                ref={(el) => {
                  items.current[i] = el;
                }}
                className="flex h-full flex-none flex-col items-center justify-end"
                style={{ scrollSnapAlign: "center" }}
              >
                <button
                  onClick={() => centerOn(i, "smooth")}
                  className="spine-title flex-none px-0 py-[9px] transition-opacity duration-200"
                  style={{
                    width: w,
                    height: h,
                    borderRadius: "1px 3px 3px 1px",
                    background: color,
                    color: spineTextColor(color),
                    fontSize: w > 26 ? 10.5 : 9.5,
                    letterSpacing: ".02em",
                    // The selected book is shown in the frame instead, so its
                    // spine steps aside rather than peeking out behind.
                    opacity: isSelected ? 0 : 1,
                  }}
                  aria-label={b.title}
                  aria-current={isSelected}
                >
                  {b.title}
                </button>
                <div style={{ height: SHELF_LINE }} />
                <Num
                  className={cn(
                    "text-[11px] leading-[19px] transition-colors",
                    isSelected ? "font-semibold text-ink" : "font-medium text-muted"
                  )}
                >
                  {b.avg !== null ? b.avg.toFixed(1) : "—"}
                </Num>
              </div>
            );
          })}
        </div>
      </div>

      {/* The frame. Fixed in place; only its contents change. */}
      {current && (
        <div
          className="cover-lift pointer-events-none absolute z-10 overflow-hidden"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            left: "50%",
            bottom: SCORE_ROW,
            borderRadius: "2px 5px 5px 2px",
            background: spineColor(current.title),
            transform: "translateX(-50%) perspective(600px) rotateY(-26deg)",
            transformOrigin: "left center",
          }}
        >
          <BookCover book={current} className="h-full w-full" fit="cover" eager />
          <span
            className="num absolute bottom-[7px] right-[7px] rounded-md px-[7px] py-[3px] text-[13px] font-semibold text-ink"
            style={{ background: "#fff5e7" }}
          >
            {current.avg !== null ? current.avg.toFixed(1) : "—"}
          </span>
          {isDarkSpine(spineColor(current.title)) && null}
        </div>
      )}
    </div>
  );
}
