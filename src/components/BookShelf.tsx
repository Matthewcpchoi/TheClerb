"use client";

import { Book } from "@/types";
import Link from "next/link";
import { useMemo, useState } from "react";
import { getExactPageCount } from "@/lib/utils";

interface BookShelfProps {
  currentBook: Book | null;
  completedBooks: Book[];
  hallOfFame: (Book & { avgRating: number }) | null;
  hallOfShame: (Book & { avgRating: number }) | null;
  bookRatings: Record<string, number>;
}

function BookTile({ book, score }: { book: Book; score?: number }) {
  const [imageSrc, setImageSrc] = useState(book.cover_url || book.thumbnail_url || "");
  const pageCount = getExactPageCount(book);

  return (
    <Link href={`/book/${book.id}`} className="book-tile block flex-shrink-0">
      <div className="text-center w-24 sm:w-28">
        <div className="relative cursor-pointer transition-transform duration-200 hover:-translate-y-1 mx-auto">
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={book.title}
              className="w-24 h-36 sm:w-28 sm:h-40 object-cover rounded shadow-lg"
              referrerPolicy="no-referrer"
              onError={() => {
                if (imageSrc !== (book.thumbnail_url || "")) {
                  setImageSrc(book.thumbnail_url || "");
                } else {
                  setImageSrc("");
                }
              }}
            />
          ) : (
            <div
              className="w-24 h-36 sm:w-28 sm:h-40 rounded shadow-lg flex items-center justify-center p-2"
              style={{ backgroundColor: book.spine_color || "#3C1518" }}
            >
              <p className="font-serif text-cream text-xs text-center leading-tight">{book.title}</p>
            </div>
          )}
        </div>
        <p className="font-serif text-sm text-cream mt-2 line-clamp-2 min-h-10">{book.title}</p>
        {typeof pageCount === "number" && (
          <p className="font-sans text-xs text-cream/80 truncate">{pageCount} pages</p>
        )}
        <p className="font-serif text-sm text-gold mt-0.5 font-semibold">
          {score !== undefined ? `★ ${score.toFixed(1)}` : "—"}
        </p>
      </div>
    </Link>
  );
}

function FeaturedBook({
  book,
  title,
  titleClassName,
  score,
  dim,
}: {
  book: (Book & { avgRating: number }) | null;
  title: string;
  titleClassName: string;
  score?: number;
  dim?: boolean;
}) {
  const [imageSrc, setImageSrc] = useState(book?.cover_url || book?.thumbnail_url || "");

  if (!book) {
    return <p className="text-xs text-cream/60 font-sans italic">No ratings yet</p>;
  }

  return (
    <Link href={`/book/${book.id}`} className="block text-center">
      <p className={`font-serif text-lg tracking-wide mb-2 ${titleClassName}`}>{title}</p>
      <div className="inline-block">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={book.title}
            className="w-24 h-36 sm:w-28 sm:h-40 object-cover rounded shadow-xl"
            style={dim ? { filter: "saturate(0.65) brightness(0.85)" } : undefined}
            referrerPolicy="no-referrer"
            onError={() => {
              if (imageSrc !== (book.thumbnail_url || "")) {
                setImageSrc(book.thumbnail_url || "");
              } else {
                setImageSrc("");
              }
            }}
          />
        ) : (
          <div className="w-24 h-36 sm:w-28 sm:h-40 bg-mahogany rounded shadow-xl flex items-center justify-center p-2">
            <p className="font-serif text-cream text-xs text-center">{book.title}</p>
          </div>
        )}
      </div>
      <div className="mt-2 rounded px-2 py-1 inline-block bg-black/20 border border-white/10">
        <p className="font-sans text-xs text-cream/90 font-semibold">{(score ?? book.avgRating).toFixed(1)}</p>
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
  const spotlightCard = useMemo(
    () => (
      <div className="bg-cream text-mahogany rounded-xl shadow-lg px-4 py-3 w-[150px] sm:w-[180px]">
        <p className="font-script text-2xl leading-none">Currently</p>
        <p className="font-script text-2xl leading-none mb-2">Reading</p>
        {currentBook ? (
          <>
            <p className="font-serif text-2xl leading-tight">{currentBook.title}</p>
            {currentBook.author && <p className="font-serif text-base text-warm-brown/80 mt-1">{currentBook.author}</p>}
          </>
        ) : (
          <p className="font-serif text-lg">Next pick coming soon</p>
        )}
      </div>
    ),
    [currentBook]
  );

  return (
    <div className="max-w-4xl mx-auto w-full px-1 sm:px-0">
      <div className="bookcase-frame rounded-xl overflow-hidden shadow-2xl">
        <div className="bookcase-top rounded-t-xl" />
        <div className="flex">
          <div className="bookcase-side rounded-sm" />

          <div className="flex-1">
            <section className="shelf-back px-3 sm:px-5 py-4 sm:py-5 min-h-[260px] sm:min-h-[300px]">
              <div className="shelf-spotlight" />
              <div className="relative z-10 flex items-end justify-between gap-4">
                <div className="overflow-x-auto scrollbar-hide pb-2 max-w-[55%]">
                  <div className="flex items-end gap-4 min-w-max snap-x snap-mandatory">
                    {currentBook ? <BookTile book={currentBook} score={bookRatings[currentBook.id]} /> : null}
                  </div>
                </div>
                {spotlightCard}
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />

            <section className="shelf-back px-3 sm:px-5 py-4 sm:py-5 min-h-[260px] sm:min-h-[300px]">
              <p className="font-serif text-xl sm:text-2xl tracking-wide text-cream/90 mb-3">PAST READS</p>
              <div className="overflow-x-auto scrollbar-hide pb-2">
                <div className="flex items-end gap-4 min-w-max snap-x snap-mandatory">
                  {completedBooks.map((book) => (
                    <BookTile key={book.id} book={book} score={bookRatings[book.id]} />
                  ))}
                </div>
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />

            <section className="shelf-back px-3 sm:px-5 py-4 sm:py-5 min-h-[230px] sm:min-h-[250px]">
              <div className="flex items-end justify-between gap-3 sm:gap-6">
                <div className="flex-1 flex justify-center">
                  <FeaturedBook
                    book={hallOfFame}
                    title="HALL OF FAME"
                    titleClassName="text-yellow-300"
                    score={hallOfFame?.avgRating}
                  />
                </div>

                <div className="w-px h-36 sm:h-40 bg-cream/40 self-center" />

                <div className="flex-1 flex justify-center">
                  <FeaturedBook
                    book={hallOfShame}
                    title="HALL OF SHAME"
                    titleClassName="text-red-900"
                    score={hallOfShame?.avgRating}
                    dim
                  />
                </div>
              </div>
            </section>
            <div className="wood-shelf rounded-sm" />
          </div>

          <div className="bookcase-side rounded-sm" />
        </div>
      </div>
    </div>
  );
}
