"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Book } from "@/types";
import BookCover from "./BookCover";
import { Num } from "./ui";
import { leather, scoreColor, spineHeight, spineWidth } from "@/lib/design";
import { cn } from "@/lib/utils";

/**
 * The shelf reads like the number wheel on a clock app: the cover frame is
 * fixed and the books travel behind it. Whichever book comes to rest under
 * the frame is selected and fills it, so scrolling back through what the club
 * has read never moves the thing you are looking at.
 */

const FRAME_W = 104;
const FRAME_H = 156;
const SCORE_ROW = 22;
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

  // Half the viewport in real pixels, so the first and last book can both
  // reach the centre. A percentage here left the last few unreachable.
  const [pad, setPad] = useState(0);
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

  useEffect(() => {
    if (pad > 0) centerOn(selectedRef.current, "auto");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [books.length, pad, centerOn]);

  useEffect(
    () => () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
    },
    []
  );

  const current = books[selected];

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
          scrollSnapType: "x mandatory",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent)",
          maskImage:
            "linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent)",
        }}
      >
        <div
          className="flex h-full items-end gap-[5px]"
          style={{ paddingLeft: pad, paddingRight: pad }}
        >
          {books.map((b, i) => {
            const skin = leather(b.title);
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
                  className="spine spine-title flex-none px-0 py-[10px] transition-opacity duration-200"
                  style={{
                    width: w,
                    height: h,
                    borderRadius: "1px 3px 3px 1px",
                    backgroundColor: skin.hex,
                    color: skin.text,
                    fontSize: w > 30 ? 11 : 10,
                    letterSpacing: ".01em",
                    // Its cover is in the frame, so the spine steps aside.
                    opacity: isSelected ? 0 : 1,
                  }}
                  aria-label={b.title}
                  aria-current={isSelected}
                >
                  {b.title}
                </button>
                <div style={{ height: SHELF_LINE }} />
                <Num
                  className="text-[11px] leading-[19px] transition-all"
                  style={undefined}
                >
                  <span
                    style={{
                      color: isSelected ? scoreColor(b.avg) : "#3d6a58",
                      fontWeight: isSelected ? 600 : 500,
                    }}
                  >
                    {b.avg !== null ? b.avg.toFixed(1) : "—"}
                  </span>
                </Num>
              </div>
            );
          })}
        </div>
      </div>

      {/* The frame. Fixed, facing straight on; only its contents change. */}
      {current && (
        <div
          className="pointer-events-none absolute z-10 overflow-hidden"
          style={{
            width: FRAME_W,
            height: FRAME_H,
            left: "50%",
            bottom: SCORE_ROW,
            transform: "translateX(-50%)",
            borderRadius: "2px 4px 4px 2px",
            background: leather(current.title).hex,
            boxShadow:
              "0 14px 26px rgba(28,17,8,.34), 0 2px 5px rgba(28,17,8,.22), inset 0 0 0 1px rgba(0,0,0,.18)",
          }}
        >
          <BookCover book={current} className="h-full w-full" fit="cover" eager />
          <span
            className={cn("num absolute bottom-[7px] right-[7px] rounded-md px-[7px] py-[3px] text-[13px] font-semibold")}
            style={{ background: "#fff5e7", color: scoreColor(current.avg) }}
          >
            {current.avg !== null ? current.avg.toFixed(1) : "—"}
          </span>
        </div>
      )}
    </div>
  );
}
