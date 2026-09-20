"use client";

import { useEffect, useState } from "react";
import { Minus, Plus } from "@phosphor-icons/react";
import { Num, SolidButton } from "./ui";
import { scoreColor, scoreWord } from "@/lib/design";

/**
 * A continuous 0–10 score to one decimal place. The old tick row could only
 * land on half points and made 9.6 impossible; the nudges either side are
 * what make a tenth reachable with a thumb.
 */
export default function ScoreSlider({
  value,
  onSave,
  saving = false,
}: {
  value: number | null;
  onSave: (v: number) => void;
  saving?: boolean;
}) {
  const [draft, setDraft] = useState(value ?? 7);
  useEffect(() => {
    if (value !== null) setDraft(value);
  }, [value]);

  const colour = scoreColor(draft);
  const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));
  const dirty = value === null || Math.abs(draft - value) > 0.001;

  return (
    <div>
      <div className="flex items-end justify-between">
        <Num className="text-[52px] font-semibold leading-none" style={undefined}>
          <span style={{ color: colour }}>{draft.toFixed(1)}</span>
        </Num>
        <span className="pb-1 text-[12.5px]" style={{ color: colour }}>
          {scoreWord(draft)}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          onClick={() => setDraft((d) => clamp(d - 0.1))}
          aria-label="Down a tenth"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-tan text-ink active:bg-tan/40"
        >
          <Minus size={14} weight="bold" />
        </button>

        <input
          type="range"
          min={0}
          max={10}
          step={0.1}
          value={draft}
          onChange={(e) => setDraft(parseFloat(e.target.value))}
          className="score-slider flex-1"
          style={{
            color: colour,
            background: `linear-gradient(90deg, ${colour} ${draft * 10}%, var(--tan) ${draft * 10}%)`,
          }}
          aria-label="Your score"
        />

        <button
          onClick={() => setDraft((d) => clamp(d + 0.1))}
          aria-label="Up a tenth"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-tan text-ink active:bg-tan/40"
        >
          <Plus size={14} weight="bold" />
        </button>
      </div>

      {dirty && (
        <SolidButton className="mt-4 w-full" onClick={() => onSave(draft)} disabled={saving}>
          {saving ? "Saving…" : value === null ? "Score it" : "Update score"}
        </SolidButton>
      )}
    </div>
  );
}
