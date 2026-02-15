"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Book, Meeting } from "@/types";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalMembers: 0,
    avgRating: null as number | null,
    totalPages: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // Fetch current book
    const { data: reading } = await supabase
      .from("books")
      .select("*")
      .eq("status", "reading")
      .limit(1)
      .single();
    if (reading) setCurrentBook(reading);

    // Fetch next upcoming meeting
    const now = new Date().toISOString().split("T")[0];
    const { data: meetings } = await supabase
      .from("meetings")
      .select("*, book:books(*)")
      .gte("date", now)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(1);
    if (meetings && meetings.length > 0) setNextMeeting(meetings[0]);

    // Fetch stats
    const { count: bookCount } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: memberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });

    // Total pages across all books (completed + reading)
    const { data: allBooks } = await supabase
      .from("books")
      .select("page_count")
      .in("status", ["completed", "reading"]);

    const totalPages = allBooks
      ? allBooks.reduce((sum, b) => sum + (b.page_count || 0), 0)
      : 0;

    // Avg rating across ALL visible ratings
    const { data: allRatings } = await supabase
      .from("ratings")
      .select("pre_rating, post_rating")
      .eq("is_visible", true);

    let avgRating: number | null = null;
    if (allRatings && allRatings.length > 0) {
      const vals = allRatings
        .map((r) => r.post_rating ?? r.pre_rating)
        .filter((v): v is number => v !== null);
      if (vals.length > 0) {
        avgRating = vals.reduce((a, b) => a + b, 0) / vals.length;
      }
    }

    setStats({
      totalBooks: bookCount || 0,
      totalMembers: memberCount || 0,
      avgRating,
      totalPages,
    });
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Hero */}
      <div className="text-center py-16">
        <h1 className="font-serif text-6xl md:text-7xl text-mahogany tracking-wide mb-4">
          The Clerb
        </h1>
        <p className="font-sans text-lg text-warm-brown/70 max-w-md mx-auto">
          A gathering of readers. One book at a time.
        </p>
      </div>

      {/* Currently Reading */}
      {currentBook && (
        <Link href={`/book/${currentBook.id}`}>
          <div className="bg-white/50 rounded-xl border border-cream-dark p-8 mb-8 hover:shadow-lg transition-shadow cursor-pointer">
            <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-widest mb-4">
              Currently Reading
            </p>
            <div className="flex items-start gap-6">
              {(currentBook.cover_url || currentBook.thumbnail_url) && (
                <img
                  src={currentBook.cover_url || currentBook.thumbnail_url || ""}
                  alt={currentBook.title}
                  className="w-28 h-40 object-cover rounded-lg shadow-lg flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
              <div>
                <h2 className="font-serif text-2xl text-charcoal mb-1">
                  {currentBook.title}
                </h2>
                {currentBook.author && (
                  <p className="font-sans text-warm-brown">
                    {currentBook.author}
                  </p>
                )}
                {currentBook.page_count && (
                  <p className="font-sans text-sm text-warm-brown/50 mt-1">
                    {currentBook.page_count} pages
                  </p>
                )}
              </div>
            </div>
          </div>
        </Link>
      )}

      {!currentBook && (
        <div className="bg-white/50 rounded-xl border border-cream-dark p-8 mb-8 text-center">
          <p className="font-sans text-warm-brown/60 italic">
            No book currently being read.
          </p>
          <Link
            href="/shelf"
            className="inline-block mt-3 px-5 py-2 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
          >
            Visit The Shelf
          </Link>
        </div>
      )}

      {/* Next Club Meeting */}
      {nextMeeting && (
        <Link href="/calendar">
          <div className="bg-white/50 rounded-xl border border-gold/30 p-6 mb-8 hover:shadow-lg transition-shadow cursor-pointer">
            <div className="flex items-start gap-5">
              <div className="flex-shrink-0 w-14 h-14 bg-gold/15 rounded-lg flex flex-col items-center justify-center">
                <span className="font-serif text-lg text-gold font-bold leading-none">
                  {new Date(nextMeeting.date + "T00:00:00").getDate()}
                </span>
                <span className="font-sans text-[10px] text-gold/70 uppercase">
                  {new Date(nextMeeting.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-sans text-xs text-gold uppercase tracking-widest mb-1">
                  Next Club
                </p>
                <h3 className="font-serif text-lg text-charcoal truncate">
                  {nextMeeting.title}
                </h3>
                <p className="font-sans text-sm text-warm-brown/70 mt-0.5">
                  {formatDate(nextMeeting.date)} at {formatTime(nextMeeting.time)}
                </p>
                {nextMeeting.location && (
                  <p className="font-sans text-sm text-warm-brown/50 mt-0.5">
                    {nextMeeting.location}
                  </p>
                )}
              </div>
              {nextMeeting.book && (nextMeeting.book.cover_url || nextMeeting.book.thumbnail_url) && (
                <img
                  src={nextMeeting.book.cover_url || nextMeeting.book.thumbnail_url || ""}
                  alt={nextMeeting.book.title}
                  className="w-12 h-16 object-cover rounded shadow-sm flex-shrink-0"
                  referrerPolicy="no-referrer"
                />
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">
            {stats.totalBooks}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">
            Books Read
          </p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">
            {stats.totalMembers}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">Members</p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-gold font-bold">
            {stats.avgRating !== null
              ? stats.avgRating.toFixed(1)
              : "\u2014"}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">
            Avg Rating
          </p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">
            {stats.totalPages > 0 ? stats.totalPages.toLocaleString() : "\u2014"}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">
            Total Pages
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/shelf"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            The Shelf
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">
            Browse the collection
          </p>
        </Link>
        <Link
          href="/calendar"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            Calendar
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">
            Upcoming meetings
          </p>
        </Link>
        <Link
          href="/members"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            Members
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">
            The readers
          </p>
        </Link>
      </div>
    </div>
  );
}
