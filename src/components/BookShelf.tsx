"use client";

import { Book } from "@/types";
import Link from "next/link";

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

export default function BookShelf({
  currentBook,
  completedBooks,
  hallOfFame,
  hallOfShame,
  bookRatings,
}: BookShelfProps) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="rounded-lg overflow-hidden shadow-xl">
        <div className="bookcase-top rounded-t-lg" />
        <div className="flex">
          <BookcaseSide />

          <div className="flex-1 space-y-0">
            <div className="shelf-back px-4 pt-6 pb-2 min-h-[280px] flex items-end justify-center">
              {currentBook ? (
                <div className="flex items-end gap-6 mb-2">
                  <Link href={`/book/${currentBook.id}`}>
                    <div
                      className="relative cursor-pointer"
                      style={{
                        transform: "perspective(600px) rotateY(-5deg)",
                        transformOrigin: "left center",
                      }}
                    >
                      {currentBook.cover_url || currentBook.thumbnail_url ? (
                        <img
                          src={
                            currentBook.cover_url ||
                            currentBook.thumbnail_url ||
                            ""
                          }
                          alt={currentBook.title}
                          className="w-36 h-52 object-cover rounded shadow-xl"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-36 h-52 bg-mahogany rounded shadow-xl flex items-center justify-center p-4">
                          <p className="font-serif text-cream text-center text-sm">
                            {currentBook.title}
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 rounded bg-gradient-to-r from-black/10 to-transparent" />
                    </div>
                  </Link>

                  <div className="mb-4 max-w-[200px]">
                    <div className="bg-cream border border-gold/30 rounded-lg p-4 shadow-md transform -rotate-1">
                      <p className="font-serif italic text-xs text-warm-brown mb-1">
                        Currently Reading
                      </p>
                      <p className="font-serif text-base text-mahogany leading-tight">
                        {currentBook.title}
                      </p>
                      {currentBook.author && (
                        <p className="font-sans text-xs text-warm-brown mt-1">
                          {currentBook.author}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center mb-4">
                  <div className="w-32 h-44 border-2 border-dashed border-warm-brown/30 rounded flex items-center justify-center mx-auto mb-3">
                    <svg
                      className="w-8 h-8 text-warm-brown/30"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                  <p className="font-serif italic text-warm-brown/60 text-sm">
                    Next pick coming soon...
                  </p>
                </div>
              )}
            </div>
            <WoodShelf />

            <div className="shelf-back px-4 pt-4 pb-2 min-h-[260px]">
              {completedBooks.length > 0 ? (
                <>
                  <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider mb-3">
                    Past Reads
                  </p>
                  <div className="flex items-end gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {completedBooks.map((book) => (
                      <Link key={book.id} href={`/book/${book.id}`} className="block flex-shrink-0">
                        <div className="text-center">
                          <div
                            className="relative cursor-pointer transition-transform duration-200 hover:-translate-y-1"
                            style={{
                              transform: "perspective(400px) rotateY(-3deg)",
                              transformOrigin: "left center",
                            }}
                          >
                            {book.cover_url || book.thumbnail_url ? (
                              <img
                                src={book.thumbnail_url || book.cover_url || ""}
                                alt={book.title}
                                className="w-20 h-28 object-cover rounded shadow-lg"
                                referrerPolicy="no-referrer"
                              />
                            ) : (
                              <div
                                className="w-20 h-28 rounded shadow-lg flex items-center justify-center p-2"
                                style={{ backgroundColor: book.spine_color || "#3C1518" }}
                              >
                                <p className="font-serif text-cream text-[10px] text-center leading-tight">
                                  {book.title}
                                </p>
                              </div>
                            )}
                            <div className="absolute inset-0 rounded bg-gradient-to-r from-black/10 to-transparent pointer-events-none" />
                          </div>
                          <p className="font-sans text-[10px] text-gold mt-1">
                            {bookRatings[book.id] !== undefined
                              ? `★ ${bookRatings[book.id].toFixed(1)}`
                              : "—"}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <p className="font-sans text-sm text-warm-brown/40 italic">
                    Completed books will appear here
                  </p>
                </div>
              )}
            </div>
            <WoodShelf />

            <div className="shelf-back px-4 pt-4 pb-2 min-h-[240px]">
              <div className="flex items-end">
                <div className="flex-1 flex flex-col items-center">
                  {hallOfFame ? (
                    <Link href={`/book/${hallOfFame.id}`} className="block">
                      <div className="text-center cursor-pointer">
                        <div className="gold-shimmer rounded-lg inline-block">
                          {hallOfFame.cover_url || hallOfFame.thumbnail_url ? (
                            <img
                              src={
                                hallOfFame.cover_url ||
                                hallOfFame.thumbnail_url ||
                                ""
                              }
                              alt={hallOfFame.title}
                              className="w-24 h-36 object-cover rounded shadow-lg"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-24 h-36 bg-mahogany rounded shadow-lg flex items-center justify-center p-2">
                              <p className="font-serif text-cream text-xs text-center">
                                {hallOfFame.title}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 bg-gold/20 border border-gold/40 rounded px-3 py-1.5 inline-block">
                          <p className="font-serif text-xs text-gold">
                            Club Favorite
                          </p>
                          <p className="font-sans text-xs text-mahogany font-semibold">
                            {hallOfFame.avgRating.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-xs text-warm-brown/40 font-sans italic">
                      No ratings yet
                    </p>
                  )}
                </div>

                <div className="w-px h-40 bg-warm-brown/20 mx-2 self-center" />

                <div className="flex-1 flex flex-col items-center">
                  {hallOfShame ? (
                    <Link href={`/book/${hallOfShame.id}`} className="block">
                      <div className="text-center cursor-pointer">
                        <div className="rounded-lg inline-block relative">
                          {hallOfShame.cover_url ||
                          hallOfShame.thumbnail_url ? (
                            <img
                              src={
                                hallOfShame.cover_url ||
                                hallOfShame.thumbnail_url ||
                                ""
                              }
                              alt={hallOfShame.title}
                              className="w-24 h-36 object-cover rounded shadow-lg"
                              style={{
                                filter: "saturate(0.5) brightness(0.85)",
                              }}
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div
                              className="w-24 h-36 bg-gray-600 rounded shadow-lg flex items-center justify-center p-2"
                              style={{ filter: "saturate(0.5)" }}
                            >
                              <p className="font-serif text-cream text-xs text-center">
                                {hallOfShame.title}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2 bg-charcoal/5 border border-charcoal/10 rounded px-3 py-1.5 inline-block">
                          <p className="font-serif text-xs text-warm-brown/60 italic">
                            Better luck next time
                          </p>
                          <p className="font-sans text-xs text-charcoal font-semibold">
                            {hallOfShame.avgRating.toFixed(1)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ) : (
                    <p className="text-xs text-warm-brown/40 font-sans italic">
                      No ratings yet
                    </p>
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
