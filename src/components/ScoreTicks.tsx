"use client";

import { Num } from "./ui";

/**
 * Score entry: 21 ticks, 0–10 in half-point steps, taller at every second
 * whole number, filled up to your score. Carried over from the design's book
 * screen — the approved Reading/Shelf screens have no score-entry surface.
 */
export default function ScoreTicks({
  value,
  onChange,
  disabled = false,
}: {
  value: number | null;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const ticks = Array.from({ length: 21 }, (_, i) => i);

  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="kicker text-muted">Your score</span>
        <Num className="text-[26px] font-semibold leading-none text-ink">
          {value === null ? "—" : value.toFixed(1)}
        </Num>
      </div>

      <div className="mt-[14px] flex h-[30px] items-end">
        {ticks.map((i) => {
          const v = i / 2;
          const on = value !== null && v <= value;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => onChange(v)}
              aria-label={`Score ${v.toFixed(1)}`}
              className="mx-[1px] flex-1 self-end rounded-[1px] transition-colors"
              style={{
                height: i % 4 === 0 ? 30 : 20,
                background: on ? "#009774" : "#e6d2b6",
              }}
            />
          );
        })}
      </div>

      <div className="mt-[7px] flex justify-between">
        <Num className="text-[10.5px] text-muted">0</Num>
        <Num className="text-[10.5px] text-muted">5</Num>
        <Num className="text-[10.5px] text-muted">10</Num>
      </div>
    </div>
  );
}
