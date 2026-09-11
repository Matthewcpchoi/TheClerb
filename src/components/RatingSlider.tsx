"use client";

import { useState } from "react";
import { Button, scoreTone } from "./ui";

interface RatingSliderProps {
  label: string;
  initialValue?: number;
  onSubmit: (value: number, note?: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  /** Show an optional "what changed?" note under the slider. */
  withNote?: boolean;
}

export default function RatingSlider({
  label,
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Save rating",
  cancelLabel = "Cancel",
  withNote = false,
}: RatingSliderProps) {
  const [value, setValue] = useState(initialValue ?? 7);
  const [note, setNote] = useState("");
  const tone = scoreTone(value);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-brown">
            {label}
          </p>
          <p className="font-sans text-xs mt-1" style={{ color: tone.bg }}>
            {tone.label}
          </p>
        </div>
        <span
          className="font-sans text-5xl font-semibold tabular-nums leading-none tracking-tight"
          style={{ color: tone.bg }}
        >
          {value.toFixed(1)}
        </span>
      </div>

      <div>
        <input
          type="range"
          min="0"
          max="10"
          step="0.1"
          value={value}
          onChange={(e) => setValue(parseFloat(e.target.value))}
          className="rating-slider w-full"
          aria-label={label}
        />
        <div className="flex justify-between font-sans text-[11px] text-warm-brown/60 mt-2 px-0.5">
          <span>0</span>
          <span>5</span>
          <span>10</span>
        </div>
      </div>

      {withNote && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed your mind? (optional)"
          rows={2}
          className="w-full px-4 py-3 rounded-xl border border-charcoal/10 bg-white font-sans text-sm text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 resize-none"
        />
      )}

      <div className="flex gap-2">
        {onCancel && (
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {cancelLabel}
          </Button>
        )}
        <Button className="flex-1" onClick={() => onSubmit(value, note.trim() || undefined)}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
