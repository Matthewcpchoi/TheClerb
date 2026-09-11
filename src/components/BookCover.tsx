"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { getBookCoverCandidates, type CoverIdentifiers } from "@/lib/covers";
import { getDeterministicSpineColor } from "@/lib/color-extract";

/**
 * Google serves a grey "image not available" bitmap with HTTP 200 rather than
 * a 404, so onError never fires for it. It is consistently tiny, so treat an
 * undersized decoded image as a failure and advance the cascade.
 */
const MIN_COVER_WIDTH = 60;

interface BookCoverProps {
  book: CoverIdentifiers & { title: string; spine_color?: string | null };
  /** Sizing/rounding classes. Applied to the image and the fallback alike. */
  className?: string;
  /** Covers vary in aspect ratio; "contain" avoids cropping the artwork. */
  fit?: "contain" | "cover";
  eager?: boolean;
  style?: CSSProperties;
}

export default function BookCover({
  book,
  className = "",
  fit = "contain",
  eager = false,
  style,
}: BookCoverProps) {
  // Depend on the identifier fields, not the book object: refetches hand back
  // a new object every time, which would reset the cascade on every render.
  const candidates = useMemo(
    () => getBookCoverCandidates(book),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      book.cover_url,
      book.thumbnail_url,
      book.isbn,
      book.google_books_id,
      book.title,
      book.author,
    ]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [candidates]);

  const background = book.spine_color || getDeterministicSpineColor(book.title);
  const src = candidates[index];

  // Cascade exhausted (or nothing to try): typographic fallback cover.
  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center p-2 overflow-hidden`}
        style={{ backgroundColor: background, ...style }}
        role="img"
        aria-label={`No cover available for ${book.title}`}
      >
        <p className="font-serif text-cream text-xs text-center leading-tight line-clamp-4">
          {book.title}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Cover of ${book.title}`}
      className={`${className} ${fit === "contain" ? "object-contain" : "object-cover"}`}
      style={{ backgroundColor: background, ...style }}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth < MIN_COVER_WIDTH) {
          setIndex((i) => i + 1);
        }
      }}
    />
  );
}
