"use client";

import { Book } from "@/types";
import Link from "next/link";
import { useState } from "react";

interface BookShelfProps {
  currentBook: Book | null;
  completedBooks: Book[];
  hallOfFame: (Book & { avgRating: number }) | null;
  hallOfShame: (Book & { avgRating: number }) | null;
  bookRatings: Record<string, number>;
}

function WoodShelf() {
  return <div className="wood-shelf rounded-sm" />;
}

function BookcaseSide() {
  return <div className="bookcase-side rounded-sm" />;
}

function BookTile({ book, score }: { book: Book; score?: number }) {
  const [imageSrc, setImageSrc] = useState(book.thumbnail_url || book.cover_url || "");
  const hasPageCount = typeof book.page_count === "number";

  return (
    <Link href={`/book/${book.id}`} className="block flex-shrink-0">
      <div className="text-center w-24">
        <div
          className="relative cursor-pointer transition-transform duration-200 hover:-translate-y-1 mx-auto"
          style={{
            transform: "perspective(400px) rotateY(-3deg)",
            transformOrigin: "left center",
          }}
        >
          {imageSrc ? (
            <img
              src={imageSrc}
              alt={book.title}
              className="w-24 h-36 object-cover rounded shadow-lg"
              referrerPolicy="no-referrer"
              onError={() => {
                if (imageSrc !== (book.cover_url || "")) {
                  setImageSrc(book.cover_url || "");
                } else {
                  setImageSrc("");
                }
              }}
            />
          ) : (
            <div
              className="w-24 h-36 rounded shadow-lg flex items-center justify-center p-2"
              style={{ backgroundColor: book.spine_color || "#3C1518" }}
            >
              <p className="font-serif text-cream text-xs text-center leading-tight">{book.title}</p>
            </div>
          )}
          <div className="absolute inset-0 rounded bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
        </div>
        <p className="font-serif text-sm text-charcoal mt-2 line-clamp-2 min-h-10">{book.title}</p>
        {hasPageCount && <p className="font-sans text-xs text-warm-brown/70 truncate">{book.page_count} pages</p>}
        <p className="font-serif text-base text-gold mt-0.5 font-semibold">
          {score !== undefined ? `★ ${score.toFixed(1)}` : "—"}
        </p>
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
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="rounded-lg overflow-hidden shadow-xl">
        <div className="bookcase-top rounded-t-lg" />
        <div className="flex">
          <BookcaseSide />

          <div className="flex-1 space-y-0">
            <div className="shelf-back px-3 sm:px-4 pt-4 pb-2 min-h-[220px] sm:min-h-[260px]">
              {currentBook ? (
                <div>
                  <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider mb-3">
                    Currently Reading
                  </p>
                  <div className="flex items-end gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    <BookTile book={currentBook} score={bookRatings[currentBook.id]} />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <p className="font-sans text-sm text-warm-brown/40 italic">Next pick coming soon...</p>
                </div>
              )}
            </div>
            <WoodShelf />

            <div className="shelf-back px-3 sm:px-4 pt-4 pb-2 min-h-[220px] sm:min-h-[260px]">
              {completedBooks.length > 0 ? (
                <>
                  <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider mb-3">Past Reads</p>
                  <div className="flex items-end gap-4 overflow-x-auto pb-2 scrollbar-hide">
                    {completedBooks.map((book) => (
                      <BookTile key={book.id} book={book} score={bookRatings[book.id]} />
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <p className="font-sans text-sm text-warm-brown/40 italic">Completed books will appear here</p>
                </div>
              )}
            </div>
            <WoodShelf />

            <div className="shelf-back px-3 sm:px-4 pt-4 pb-2 min-h-[220px] sm:min-h-[240px]">
              <div className="flex items-end">
                <div className="flex-1 flex flex-col items-center">
                  {hallOfFame ? (
                    <Link href={`/book/${hallOfFame.id}`} className="block">
                      <div className="text-center cursor-pointer">
                        <p className="font-serif text-sm text-yellow-400 font-semibold text-center mb-2">Hall of Fame</p>
                        <div className="gold-shimmer rounded-lg inline-block">
                          {hallOfFame.cover_url || hallOfFame.thumbnail_url ? (
                            <img
                              src={hallOfFame.thumbnail_url || hallOfFame.cover_url || ""}
                              alt={hallOfFame.title}
                              className="w-24 h-36 object-cover rounded shadow-lg"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-24 h-36 bg-mahogany rounded shadow-lg flex items-center justify-center p-2">
                              <p className="font-serif text-cream text-xs text-center">{hallOfFame.title}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 bg-gold/20 border border-gold/40 rounded px-3 py-1.5 inline-block text-center">
                          <p className="font-sans text-xs text-mahogany font-semibold">{hallOfFame.avgRating.toFixed(1)}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-xs text-warm-brown/40 font-sans italic">No ratings yet</p>
                  )}
                </div>

                <div className="w-px h-40 bg-warm-brown/20 mx-2 self-center" />

                <div className="flex-1 flex flex-col items-center">
                  {hallOfShame ? (
                    <Link href={`/book/${hallOfShame.id}`} className="block">
                      <div className="text-center cursor-pointer">
                        <p className="font-serif text-sm text-red-900 font-semibold text-center mb-2">Hall of Shame</p>
                        <div className="rounded-lg inline-block relative">
                          {hallOfShame.cover_url || hallOfShame.thumbnail_url ? (
                            <img
                              src={hallOfShame.thumbnail_url || hallOfShame.cover_url || ""}
                              alt={hallOfShame.title}
                              className="w-24 h-36 object-cover rounded shadow-lg"
                              style={{ filter: "saturate(0.5) brightness(0.85)" }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className="w-24 h-36 bg-gray-600 rounded shadow-lg flex items-center justify-center p-2"
                              style={{ filter: "saturate(0.5)" }}
                            >
                              <p className="font-serif text-cream text-xs text-center">{hallOfShame.title}</p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 bg-charcoal/5 border border-charcoal/10 rounded px-3 py-1.5 inline-block text-center">
                          <p className="font-sans text-xs text-charcoal font-semibold">{hallOfShame.avgRating.toFixed(1)}</p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-xs text-warm-brown/40 font-sans italic">No ratings yet</p>
                  )}
                </div>
              </div>
            </div>
            <WoodShelf />
          </div>

          <BookcaseSide />
        </div>
      </div>
    </div>
  );
}
