"use client";

import { useState } from "react";

interface RatingSliderProps {
  label: string;
  initialValue?: number;
  onSubmit: (value: number) => void;
  disabled?: boolean;
}

export default function RatingSlider({
  label,
  initialValue,
  onSubmit,
  disabled,
}: RatingSliderProps) {
  const [value, setValue] = useState(initialValue ?? 5);
  const [submitted, setSubmitted] = useState(initialValue !== undefined);

  function handleSubmit() {
    onSubmit(value);
    setSubmitted(true);
  }

  if (submitted && initialValue !== undefined) {
    return (
      <div className="flex items-center gap-3">
        <span className="font-sans text-sm text-warm-brown">{label}:</span>
        <span className="font-serif text-xl text-mahogany font-bold">
          {initialValue.toFixed(2)}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-sans text-sm text-warm-brown">{label}</span>
        <span className="font-serif text-2xl text-mahogany font-bold tabular-nums">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        step="0.01"
        value={value}
        onChange={(e) => setValue(parseFloat(e.target.value))}
        className="rating-slider w-full"
        disabled={disabled}
      />
      <div className="flex justify-between text-xs font-sans text-warm-brown/60">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
      <button
        onClick={handleSubmit}
        disabled={disabled}
        className="w-full py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors disabled:opacity-50"
      >
        Submit Rating
      </button>
    </div>
  );
}
