"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * A slim rail above the tab bar for moving between the sections of a long
 * screen. The green marker follows whichever section you are in, and tapping
 * a label scrolls to it.
 */
export default function SectionRail({
  sections,
}: {
  sections: { id: string; label: string }[];
}) {
  const [active, setActive] = useState(0);
  const ticking = useRef(false);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        // Whichever section header sits nearest a third of the way down.
        const line = window.innerHeight / 3;
        let best = 0;
        let bestDistance = Infinity;
        sections.forEach((s, i) => {
          const el = document.getElementById(s.id);
          if (!el) return;
          const distance = Math.abs(el.getBoundingClientRect().top - line);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = i;
          }
        });
        setActive(best);
      });
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [sections]);

  if (sections.length < 2) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[86px] z-30 flex justify-center px-5">
      <div
        className="pointer-events-auto relative flex max-w-[448px] rounded-full border border-tan p-[3px]"
        style={{ background: "rgba(255,245,231,.92)", backdropFilter: "blur(12px)" }}
      >
        <span
          className="absolute inset-y-[3px] rounded-full bg-green transition-transform duration-300"
          style={{
            width: `calc((100% - 6px) / ${sections.length})`,
            transform: `translateX(${active * 100}%)`,
          }}
        />
        {sections.map((s, i) => (
          <button
            key={s.id}
            onClick={() =>
              document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className={cn(
              "relative z-10 px-4 py-[6px] text-[11.5px] font-medium transition-colors",
              i === active ? "text-ground" : "text-muted"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}
