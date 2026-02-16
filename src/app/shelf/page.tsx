"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookShelf from "@/components/BookShelf";
import BookSearch from "@/components/BookSearch";

export default function ShelfPage() {
  const { currentMember } = useMember();
  const [books, setBooks] = useState<Book[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [hallOfFame, setHallOfFame] = useState<(Book & { avgRating: number }) | null>(null);
  const [hallOfShame, setHallOfShame] = useState<(Book & { avgRating: number }) | null>(null);

  const fetchBooks = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setBooks(data);
      await computeHallOfFameShame(data);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  async function computeHallOfFameShame(allBooks: Book[]) {
    const completed = allBooks.filter((b) => b.status === "completed");
    if (completed.length === 0) return;

    const bookRatings: { book: Book; avg: number }[] = [];

    for (const book of completed) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("pre_rating, post_rating")
        .eq("book_id", book.id)
        .eq("is_visible", true);

      if (ratings && ratings.length > 0) {
        const vals = ratings
          .map((r) => r.post_rating ?? r.pre_rating)
          .filter((v): v is number => v !== null);
        if (vals.length > 0) {
          const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
          bookRatings.push({ book, avg });
        }
      }
    }

    if (bookRatings.length > 0) {
      bookRatings.sort((a, b) => b.avg - a.avg);
      const best = bookRatings[0];
      const worst = bookRatings[bookRatings.length - 1];

      setHallOfFame({ ...best.book, avgRating: best.avg });
      if (bookRatings.length > 1) {
        setHallOfShame({ ...worst.book, avgRating: worst.avg });
      }
    }
  }

  const currentBook = books.find((b) => b.status === "reading") || null;
  const completedBooks = books.filter((b) => b.status === "completed");
  const upcomingBooks = books.filter((b) => b.status === "upcoming");

  async function handleBookAdded(book: Book) {
    setBooks((prev) => [book, ...prev]);
    setShowSearch(false);
  }

  async function handleStatusChange(bookId: string, status: Book["status"]) {
    if (status === "reading") {
      const currentlyReading = books.find((b) => b.status === "reading");
      if (currentlyReading) {
        await supabase
          .from("books")
          .update({ status: "completed" })
          .eq("id", currentlyReading.id);
      }
    }

    await supabase.from("books").update({ status }).eq("id", bookId);
    fetchBooks();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">The Shelf</h1>
          <p className="font-sans text-sm text-warm-brown/60 mt-1">
            Our collection, one spine at a time
          </p>
        </div>
        {currentMember && (
          <button
            onClick={() => setShowSearch(true)}
            className="px-5 py-2.5 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
          >
            Add Book
          </button>
        )}
      </div>

      <BookShelf
        currentBook={currentBook}
        completedBooks={completedBooks}
        hallOfFame={hallOfFame}
        hallOfShame={hallOfShame}
      />

      {/* Upcoming Books */}
      {upcomingBooks.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-charcoal mb-4">Up Next</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {upcomingBooks.map((book) => (
              <div
                key={book.id}
                className="bg-white/50 rounded-xl border border-cream-dark p-4 flex items-start gap-3"
              >
                {(book.cover_url || book.thumbnail_url) && (
                  <img
                    src={book.thumbnail_url || book.cover_url || ""}
                    alt={book.title}
                    className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm text-charcoal font-semibold truncate">
                    {book.title}
                  </p>
                  {book.author && (
                    <p className="font-sans text-xs text-warm-brown/60 truncate">
                      {book.author}
                    </p>
                  )}
                  {currentMember && (
                    <button
                      onClick={() => handleStatusChange(book.id, "reading")}
                      className="mt-2 px-3 py-1 rounded text-xs font-sans bg-gold/20 text-gold hover:bg-gold/30 transition-colors"
                    >
                      Start Reading
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mark current as complete */}
      {currentBook && currentMember && (
        <div className="mt-6 text-center">
          <button
            onClick={() => handleStatusChange(currentBook.id, "completed")}
            className="px-5 py-2 rounded-lg border border-sage text-sage font-sans text-sm hover:bg-sage hover:text-cream transition-colors"
          >
            Mark &ldquo;{currentBook.title}&rdquo; as Completed
          </button>
        </div>
      )}

      {showSearch && currentMember && (
        <BookSearch
          memberId={currentMember.id}
          onBookAdded={handleBookAdded}
          onClose={() => setShowSearch(false)}
        />
      )}
    </div>
  );
}
