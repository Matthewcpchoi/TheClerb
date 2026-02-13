"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import Link from "next/link";

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [stats, setStats] = useState({
    totalBooks: 0,
    totalMembers: 0,
    lastAvgRating: null as number | null,
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

    // Fetch stats
    const { count: bookCount } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: memberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });

    // Get last completed book's avg rating
    const { data: lastBook } = await supabase
      .from("books")
      .select("id")
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let lastAvg: number | null = null;
    if (lastBook) {
      const { data: ratings } = await supabase
        .from("ratings")
        .select("post_rating, pre_rating")
        .eq("book_id", lastBook.id)
        .eq("is_visible", true);
      if (ratings && ratings.length > 0) {
        const vals = ratings
          .map((r) => r.post_rating ?? r.pre_rating)
          .filter((v): v is number => v !== null);
        if (vals.length > 0) {
          lastAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
        }
      }
    }

    setStats({
      totalBooks: bookCount || 0,
      totalMembers: memberCount || 0,
      lastAvgRating: lastAvg,
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

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
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
            {stats.lastAvgRating !== null
              ? stats.lastAvgRating.toFixed(1)
              : "—"}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">
            Last Avg Rating
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
