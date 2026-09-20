"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Book } from "@/types";
import BookCover from "./BookCover";
import { Num } from "./ui";
import { leather, scoreColor, spineHeight, spineWidth, textOn } from "@/lib/design";

/**
 * The shelf reads like the number wheel on a clock app: the frame holds still
 * and the books travel behind it.
 *
 * Two things the first pass got wrong. CSS scroll-snap with large end padding
 * left the last books unreachable in Safari, so settling is done by hand here.
 * And the frame used to sit on top of its neighbours; now the selected book's
 * slot widens to the frame's width once the wheel comes to rest, so the cover
 * occupies a gap of its own instead of covering the books either side.
 */

const FRAME_W = 104;
const FRAME_H = 156;
const SCORE_ROW = 22;
const SHELF_LINE = 3;
const HEIGHT = FRAME_H + SCORE_ROW;
const SETTLE_MS = 130;

interface ShelfWheelProps {
  books: (Book & { avg: number | null })[];
  selected: number;
  onSelect: (index: number) => void;
}

export default function ShelfWheel({ books, selected, onSelect }: ShelfWheelProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const raf = useRef<number | null>(null);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pad, setPad] = useState(0);
  const [focused, setFocused] = useState(selected);
  const [scrolling, setScrolling] = useState(false);

  const focusedRef = useRef(focused);
  focusedRef.current = focused;

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const measure = () => setPad(el.clientWidth / 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const centerOn = useCallback((index: number, behavior: ScrollBehavior) => {
    const el = scroller.current;
    const item = items.current[index];
    if (!el || !item) return;
    el.scrollTo({
      left: item.offsetLeft + item.offsetWidth / 2 - el.clientWidth / 2,
      behavior,
    });
  }, []);

  const nearest = useCallback(() => {
    const el = scroller.current;
    if (!el) return 0;
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
    return best;
  }, []);

  const handleScroll = useCallback(() => {
    setScrolling(true);
    if (raf.current === null) {
      raf.current = requestAnimationFrame(() => {
        raf.current = null;
        setFocused(nearest());
      });
    }
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => {
      // Settle by hand: land on the nearest book, then let the slot open.
      const target = nearest();
      setFocused(target);
      setScrolling(false);
      centerOn(target, "smooth");
      onSelect(target);
    }, SETTLE_MS);
  }, [nearest, centerOn, onSelect]);

  // The settled slot is wider than a spine, which shifts everything after it.
  // Re-centre without animation so the book stays under the frame.
  useLayoutEffect(() => {
    if (!scrolling && pad > 0) centerOn(focused, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrolling, focused, pad]);

  useEffect(() => {
    if (pad > 0) centerOn(focusedRef.current, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, pad]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    []
  );

  const current = books[focused];
  const settled = !scrolling;

  return (
    <div className="relative select-none" style={{ height: HEIGHT }}>
      <div
        className="pointer-events-none absolute inset-x-5 rounded-sm bg-tan"
        style={{ bottom: SCORE_ROW - SHELF_LINE, height: SHELF_LINE }}
      />

      <div
        ref={scroller}
        onScroll={handleScroll}
        className="scrollbar-hide absolute inset-0 overflow-x-auto overflow-y-hidden overscroll-x-contain"
        style={{
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent)",
          maskImage:
            "linear-gradient(90deg, transparent, #000 26px, #000 calc(100% - 26px), transparent)",
        }}
      >
        <div className="flex h-full items-end gap-[5px]">
          {/* Spacers, not padding: padding is what stranded the last books. */}
          <div className="h-full flex-none" style={{ width: pad }} />

          {books.map((b, i) => {
            const stored = b.spine_color;
            const skin = leather(b.title);
            const hex = stored || skin.hex;
            const ink = stored ? textOn(stored) : skin.text;
            const w = spineWidth(b.title);
            const h = spineHeight(b.title);
            const isOpen = settled && i === focused;

            return (
              <div
                key={b.id}
                ref={(el) => {
                  items.current[i] = el;
                }}
                className="flex h-full flex-none flex-col items-center justify-end"
                style={{
                  width: isOpen ? FRAME_W : w,
                  transition: "width .2s ease",
                }}
              >
                <button
                  onClick={() => centerOn(i, "smooth")}
                  className="spine spine-title flex-none px-0 py-[10px]"
                  style={{
                    width: w,
                    height: h,
                    borderRadius: "1px 3px 3px 1px",
                    backgroundColor: hex,
                    color: ink,
                    fontSize: w > 30 ? 11 : 10,
                    letterSpacing: ".01em",
                    opacity: isOpen ? 0 : 1,
                    transition: "opacity .18s ease",
                  }}
                  aria-label={b.title}
                  aria-current={i === focused}
                >
                  {b.title}
                </button>
                <div style={{ height: SHELF_LINE }} />
                <Num className="text-[11px] leading-[19px]">
                  <span
                    style={{
                      color: i === focused ? scoreColor(b.avg) : "#3d6a58",
                      fontWeight: i === focused ? 600 : 500,
                    }}
                  >
                    {b.avg !== null ? b.avg.toFixed(1) : "—"}
                  </span>
                </Num>
              </div>
            );
          })}

          <div className="h-full flex-none" style={{ width: pad }} />
        </div>
      </div>

      {/* The frame. Hidden while the wheel turns, so it never sits over a
          book that is still moving. */}
      {current && (
        <div
          className="pointer-events-none absolute z-10 overflow-hidden"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            left: "50%",
            bottom: SCORE_ROW,
            transform: `translateX(-50%) scale(${settled ? 1 : 0.94})`,
            opacity: settled ? 1 : 0,
            transition: "opacity .18s ease, transform .18s ease",
            borderRadius: "2px 4px 4px 2px",
            background: current.spine_color || leather(current.title).hex,
            boxShadow:
              "0 14px 26px rgba(28,17,8,.34), 0 2px 5px rgba(28,17,8,.22), inset 0 0 0 1px rgba(0,0,0,.18)",
          }}
        >
          <BookCover book={current} className="h-full w-full" fit="cover" eager />
          <span
            className="num absolute bottom-[7px] right-[7px] rounded-md px-[7px] py-[3px] text-[13px] font-semibold"
            style={{ background: "#fff5e7", color: scoreColor(current.avg) }}
          >
            {current.avg !== null ? current.avg.toFixed(1) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
