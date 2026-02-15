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
  const [editingDateId, setEditingDateId] = useState<string | null>(null);
  const [editDateValue, setEditDateValue] = useState("");

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
    // If setting to "reading", first set all current reading books to "completed"
    if (status === "reading") {
      const currentlyReading = books.find((b) => b.status === "reading");
      if (currentlyReading) {
        await supabase
          .from("books")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", currentlyReading.id);
      }
    }

    const updates: Record<string, unknown> = { status };
    if (status === "completed") {
      updates.completed_at = new Date().toISOString();
    }
    if (status === "reading") {
      updates.completed_at = null;
    }

    await supabase.from("books").update(updates).eq("id", bookId);
    fetchBooks();
  }

  async function handleSaveCompletedDate(bookId: string) {
    await supabase
      .from("books")
      .update({ completed_at: editDateValue ? new Date(editDateValue).toISOString() : null })
      .eq("id", bookId);
    setEditingDateId(null);
    setEditDateValue("");
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

      {/* Completed Books List */}
      {completedBooks.length > 0 && (
        <div className="mt-10">
          <h2 className="font-serif text-xl text-charcoal mb-4">Completed</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {completedBooks.map((book) => (
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
                  {/* Completed date */}
                  {editingDateId === book.id ? (
                    <div className="mt-1.5 flex items-center gap-1">
                      <input
                        type="date"
                        value={editDateValue}
                        onChange={(e) => setEditDateValue(e.target.value)}
                        className="px-2 py-0.5 rounded border border-cream-dark bg-white font-sans text-xs text-charcoal focus:outline-none focus:border-gold"
                      />
                      <button
                        onClick={() => handleSaveCompletedDate(book.id)}
                        className="px-2 py-0.5 rounded text-xs font-sans bg-sage/20 text-sage hover:bg-sage/30"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingDateId(null)}
                        className="px-2 py-0.5 rounded text-xs font-sans text-warm-brown/50 hover:text-warm-brown"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingDateId(book.id);
                        setEditDateValue(
                          book.completed_at
                            ? new Date(book.completed_at).toISOString().split("T")[0]
                            : ""
                        );
                      }}
                      className="mt-1 font-sans text-xs text-warm-brown/40 hover:text-warm-brown transition-colors"
                    >
                      {book.completed_at
                        ? `Read ${new Date(book.completed_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                        : "Add date read"}
                    </button>
                  )}
                  {currentMember && (
                    <button
                      onClick={() => handleStatusChange(book.id, "reading")}
                      className="mt-1.5 px-3 py-1 rounded text-xs font-sans bg-sage/20 text-sage hover:bg-sage/30 transition-colors"
                    >
                      Read Again
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
