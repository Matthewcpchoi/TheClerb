"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import BookShelf from "@/components/BookShelf";
import BookSearch from "@/components/BookSearch";
import { Button, PageHeader } from "@/components/ui";
import { markCompleted } from "@/lib/books";

export default function ShelfPage() {
  const { currentMember } = useMember();
  const [books, setBooks] = useState<Book[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [hallOfFame, setHallOfFame] = useState<(Book & { avgRating: number }) | null>(null);
  const [hallOfShame, setHallOfShame] = useState<(Book & { avgRating: number }) | null>(null);
  const [bookRatings, setBookRatings] = useState<Record<string, number>>({});

  const fetchBooks = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) {
      setBooks(data);
      await computeRatings(data);
    }
  }, []);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  async function computeRatings(allBooks: Book[]) {
    const rated = allBooks.filter((b) => b.status !== "upcoming");
    if (rated.length === 0) {
      setBookRatings({});
      setHallOfFame(null);
      setHallOfShame(null);
      return;
    }

    const { data: ratings } = await supabase
      .from("ratings")
      .select("book_id, pre_rating, post_rating")
      .in("book_id", rated.map((b) => b.id))
      .eq("is_visible", true);

    const valuesByBook = new Map<string, number[]>();
    for (const r of ratings || []) {
      const value = r.post_rating ?? r.pre_rating;
      if (value === null) continue;
      valuesByBook.set(r.book_id, [...(valuesByBook.get(r.book_id) || []), value]);
    }

    const ratingMap: Record<string, number> = {};
    const completedRows: { book: Book; avg: number }[] = [];

    for (const book of rated) {
      const vals = valuesByBook.get(book.id);
      if (!vals || vals.length === 0) continue;
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      ratingMap[book.id] = avg;
      if (book.status === "completed") completedRows.push({ book, avg });
    }

    setBookRatings(ratingMap);

    if (completedRows.length > 0) {
      completedRows.sort((a, b) => b.avg - a.avg);
      const best = completedRows[0];
      const worst = completedRows[completedRows.length - 1];
      setHallOfFame({ ...best.book, avgRating: best.avg });
      setHallOfShame(completedRows.length > 1 ? { ...worst.book, avgRating: worst.avg } : null);
    } else {
      setHallOfFame(null);
      setHallOfShame(null);
    }
  }

  const currentBook = books.find((b) => b.status === "reading") || null;
  const completedBooks = books
    .filter((b) => b.status === "completed")
    .sort((a, b) => {
      const aScore = bookRatings[a.id];
      const bScore = bookRatings[b.id];
      if (aScore === undefined && bScore === undefined) return 0;
      if (aScore === undefined) return 1;
      if (bScore === undefined) return -1;
      return bScore - aScore;
    });
  const upcomingBooks = books.filter((b) => b.status === "upcoming");

  function handleBookAdded(book: Book) {
    setBooks((prev) => [book, ...prev]);
    setShowSearch(false);
  }

  async function handleStartReading(bookId: string) {
    const currentlyReading = books.find((b) => b.status === "reading");
    if (currentlyReading) await markCompleted(currentlyReading.id);
    await supabase.from("books").update({ status: "reading" }).eq("id", bookId);
    fetchBooks();
  }

  async function handleMarkFinished(bookId: string) {
    await markCompleted(bookId);
    fetchBooks();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <PageHeader
        eyebrow="The Clerb"
        title="The Shelf"
        subtitle={`${completedBooks.length} finished · ${upcomingBooks.length} up next`}
        action={currentMember ? <Button onClick={() => setShowSearch(true)}>Add book</Button> : undefined}
      />

      <BookShelf
        currentBook={currentBook}
        upcomingBooks={upcomingBooks}
        completedBooks={completedBooks}
        hallOfFame={hallOfFame}
        hallOfShame={hallOfShame}
        bookRatings={bookRatings}
        canEdit={Boolean(currentMember)}
        onStartReading={handleStartReading}
        onMarkFinished={handleMarkFinished}
        onAddBook={() => setShowSearch(true)}
      />

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
