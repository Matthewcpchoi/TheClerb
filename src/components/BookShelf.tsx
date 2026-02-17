"use client";

import { Book } from "@/types";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { getBookCoverCandidates, getExactPageCount } from "@/lib/utils";

interface BookShelfProps {
  currentBook: Book | null;
  completedBooks: Book[];
  hallOfFame: (Book & { avgRating: number }) | null;
  hallOfShame: (Book & { avgRating: number }) | null;
  bookRatings: Record<string, number>;
}

function ScoreBadge({ score, className = "bg-gold" }: { score: number; className?: string }) {
  return (
    <div
      className={`absolute -bottom-2 -right-2 text-cream rounded-full w-9 h-9 sm:w-10 sm:h-10 inline-flex items-center justify-center shadow-lg border-2 border-cream ${className}`}
    >
      <span className="font-serif text-base sm:text-lg font-bold leading-none tabular-nums">{score.toFixed(1)}</span>
    </div>
  );
}

function BookTile({ book, score }: { book: Book; score?: number }) {
  const imageSources = useMemo(() => getBookCoverCandidates(book), [book]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageSources[imageIndex] || "";
  const pageCount = getExactPageCount(book);

  useEffect(() => {
    setImageIndex(0);
  }, [book.id, imageSources.length]);

  return (
    <Link href={`/book/${book.id}`} className="block flex-shrink-0">
      <div className="text-center w-24 sm:w-28">
        <div className="relative cursor-pointer transition-transform duration-200 hover:-translate-y-1 mx-auto">
          <div
            className="w-24 h-36 sm:w-28 sm:h-40 rounded shadow-lg flex items-center justify-center p-2"
            style={{ backgroundColor: book.spine_color || "#3C1518" }}
          >
            {imageSrc ? (
              <img
                src={imageSrc}
                alt={book.title}
                className="absolute inset-0 w-full h-full object-cover rounded"
                style={{ color: "transparent" }}
                referrerPolicy="no-referrer"
                onError={() => setImageIndex((prev) => prev + 1)}
              />
            ) : null}
            <p className="font-serif text-cream text-xs text-center leading-tight">{book.title}</p>
          </div>
          {typeof score === "number" && <ScoreBadge score={score} />}
        </div>
        <p className="font-serif text-sm text-cream mt-2 line-clamp-2 min-h-10">{book.title}</p>
        {typeof pageCount === "number" && (
          <p className="font-sans text-xs text-cream/80 truncate">{pageCount} pages</p>
        )}
      </div>
    </Link>
  );
}

function FeaturedBook({
  book,
  title,
  score,
  dim,
  scoreBadgeClassName,
}: {
  book: (Book & { avgRating: number }) | null;
  title: string;
  score?: number;
  dim?: boolean;
  scoreBadgeClassName: string;
}) {
  const imageSources = useMemo(() => (book ? getBookCoverCandidates(book) : []), [book]);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageSources[imageIndex] || "";

  useEffect(() => {
    setImageIndex(0);
  }, [book?.id, imageSources.length]);

  if (!book) {
    return (
      <div className="text-center">
        <p className="font-serif text-sm tracking-wide mb-2 text-cream/95">{title}</p>
        <p className="text-xs text-cream/60 font-sans italic">No ratings yet</p>
      </div>
    );
  }

  const resolvedScore = score ?? book.avgRating;

  return (
    <Link href={`/book/${book.id}`} className="block text-center">
      <p className="font-serif text-sm tracking-wide mb-2 text-cream/95">{title}</p>
      <div className="inline-block relative">
        <div
          className="w-20 h-28 sm:w-24 sm:h-36 rounded shadow-xl flex items-center justify-center p-2"
          style={{
            backgroundColor: book.spine_color || "#3C1518",
            ...(dim ? { filter: "saturate(0.65) brightness(0.85)" } : {}),
          }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={book.title}
              className="absolute inset-0 w-full h-full object-cover rounded"
              style={{
                color: "transparent",
                ...(dim ? { filter: "saturate(0.65) brightness(0.85)" } : {}),
              }}
              referrerPolicy="no-referrer"
              onError={() => setImageIndex((prev) => prev + 1)}
            />
          ) : null}
          <p className="font-serif text-cream text-xs text-center">{book.title}</p>
        </div>
        <ScoreBadge score={resolvedScore} className={scoreBadgeClassName} />
      </div>
    </Link>
  );
}

export default function BookShelf({
  currentBook,
  completedBooks,
  hallOfFame,
  hallOfShame,
  bookRatings,
}: BookShelfProps) {
  const emptyCurrentReadTile = useMemo(
    () => (
      <div className="w-28 sm:w-32">
        <div className="w-28 h-40 sm:w-32 sm:h-44 rounded shadow-lg flex items-center justify-center p-3 bg-mahogany/90 border border-cream/20">
          <p className="font-serif text-cream text-sm text-center leading-tight">Next pick coming soon</p>
        </div>
      </div>
    ),
    []
  );

  return (
    <div className="w-full mx-auto">
      <div className="bookcase-frame rounded-xl overflow-hidden shadow-2xl">
        <div className="bookcase-top rounded-t-xl" />
        <div className="flex">
          <div className="bookcase-side rounded-sm hidden sm:block" />

          <div className="flex-1 min-w-0">
            <section className="shelf-back relative px-3 sm:px-5 py-3 sm:py-4 min-h-[200px] sm:min-h-[220px]">
              <p className="absolute top-3 left-3 sm:top-4 sm:left-5 font-serif text-sm sm:text-base tracking-wide text-cream/95 z-10">
                CURRENTLY READING
              </p>
              <div className="relative z-10 h-full flex items-end justify-center pt-10">
                <div className="flex items-end justify-center pb-2">
                  {currentBook ? (
                    <BookTile book={currentBook} score={bookRatings[currentBook.id]} />
                  ) : (
                    emptyCurrentReadTile
                  )}
                </div>
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />

            <section className="shelf-back px-3 sm:px-5 py-3 sm:py-4 min-h-[200px] sm:min-h-[220px]">
              <p className="font-serif text-sm sm:text-base tracking-wide text-cream/90 mb-3">PAST READS</p>
              <div
                className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide"
                style={{ WebkitOverflowScrolling: "touch" }}
              >
                {completedBooks.map((book) => (
                  <BookTile key={book.id} book={book} score={bookRatings[book.id]} />
                ))}
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />

            <section className="shelf-back px-3 sm:px-5 py-3 sm:py-4 min-h-[200px] sm:min-h-[220px]">
              <div className="flex flex-row items-start justify-around gap-4">
                <div className="flex-1 flex justify-center">
                  <FeaturedBook
                    book={hallOfFame}
                    title="HALL OF FAME"
                    score={hallOfFame?.avgRating}
                    scoreBadgeClassName="bg-green-600"
                  />
                </div>

                <div className="flex-1 flex justify-center">
                  <FeaturedBook
                    book={hallOfShame}
                    title="HALL OF SHAME"
                    score={hallOfShame?.avgRating}
                    scoreBadgeClassName="bg-red-600"
                    dim
                  />
                </div>
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />
          </div>

          <div className="bookcase-side rounded-sm hidden sm:block" />
        </div>
      </div>
    </div>
  );
}
