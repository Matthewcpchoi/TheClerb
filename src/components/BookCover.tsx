"use client";

import { CSSProperties, useEffect, useMemo, useState } from "react";
import { getBookCoverCandidates, type CoverIdentifiers } from "@/lib/covers";
import { isDarkSpine, spineColor } from "@/lib/design";

/**
 * Google serves a grey "image not available" bitmap with HTTP 200, so onError
 * never fires for it. It is consistently tiny, so an undersized decoded image
 * is treated as a failure and the cascade advances.
 */
const MIN_COVER_WIDTH = 60;

interface BookCoverProps {
  book: CoverIdentifiers & { title: string; spine_color?: string | null };
  className?: string;
  fit?: "contain" | "cover";
  eager?: boolean;
  style?: CSSProperties;
}

export default function BookCover({
  book,
  className = "",
  fit = "cover",
  eager = false,
  style,
}: BookCoverProps) {
  // Depend on the identifier fields, not the book object: refetches hand back
  // a new object every time, which would reset the cascade on every render.
  const candidates = useMemo(
    () => getBookCoverCandidates(book),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book.cover_url, book.thumbnail_url, book.isbn, book.google_books_id, book.title, book.author]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [candidates]);

  const background = spineColor(book.title);
  const src = candidates[index];

  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center overflow-hidden p-2`}
        style={{ background, ...style }}
        role="img"
        aria-label={`No cover for ${book.title}`}
      >
        <p
          className="text-center text-[11px] leading-tight"
          style={{ color: isDarkSpine(background) ? "rgba(255,245,231,.85)" : "#0e5f49" }}
        >
          {book.title}
        </p>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Cover of ${book.title}`}
      className={`${className} ${fit === "contain" ? "object-contain" : "object-cover"}`}
      style={{ background, ...style }}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth < MIN_COVER_WIDTH) setIndex((i) => i + 1);
      }}
    />
  );
}
