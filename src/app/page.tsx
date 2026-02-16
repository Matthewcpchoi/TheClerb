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
    const { data: reading } = await supabase
      .from("books")
      .select("*")
      .eq("status", "reading")
      .limit(1)
      .single();
    if (reading) setCurrentBook(reading);

    const now = new Date().toISOString().split("T")[0];
    const { data: meetings } = await supabase
      .from("meetings")
      .select("*, book:books(*)")
      .gte("date", now)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(1);
    if (meetings && meetings.length > 0) setNextMeeting(meetings[0]);

    const { data: completedBooks } = await supabase
      .from("books")
      .select("page_count")
      .eq("status", "completed");

    const totalPages = completedBooks
      ? completedBooks.reduce((sum, b) => sum + (b.page_count || 0), 0)
      : 0;

    const { count: bookCount } = await supabase
      .from("books")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed");

    const { count: memberCount } = await supabase
      .from("members")
      .select("*", { count: "exact", head: true });

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
      <div className="text-center pt-4 pb-6">
        <h1 className="font-script text-[28px] text-mahogany tracking-wide">
          The Clerb
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {currentBook ? (
          <Link href={`/book/${currentBook.id}`} className="block h-full">
            <div className="bg-white/50 rounded-xl border border-cream-dark p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
              <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-widest mb-4">
                Currently Reading
              </p>
              <div className="flex items-start gap-4 flex-1">
                {(currentBook.cover_url || currentBook.thumbnail_url) && (
                  <img
                    src={currentBook.cover_url || currentBook.thumbnail_url || ""}
                    alt={currentBook.title}
                    className="w-20 h-28 object-cover rounded-lg shadow-lg flex-shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="min-w-0">
                  <h2 className="font-serif text-xl text-charcoal mb-1 leading-tight">
                    {currentBook.title}
                  </h2>
                  {currentBook.author && (
                    <p className="font-sans text-sm text-warm-brown">
                      {currentBook.author}
                    </p>
                  )}
                  {currentBook.page_count !== null && (
                    <p className="font-sans text-xs text-warm-brown/50 mt-1">
                      {currentBook.page_count} pages
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <div className="bg-white/50 rounded-xl border border-cream-dark p-6 flex flex-col items-center justify-center h-full">
            <p className="font-sans text-warm-brown/60 italic mb-3">
              No book currently being read.
            </p>
            <Link
              href="/shelf"
              className="px-5 py-2 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
            >
              Visit The Shelf
            </Link>
          </div>
        )}

        {nextMeeting ? (
          <Link href="/calendar" className="block h-full">
            <div className="bg-white/50 rounded-xl border border-gold/30 p-6 hover:shadow-lg transition-shadow cursor-pointer h-full flex flex-col">
              <p className="font-sans text-xs text-gold uppercase tracking-widest mb-4">
                Next Club
              </p>
              <div className="flex items-start gap-4 flex-1">
                <div className="flex-shrink-0 w-14 h-14 bg-gold/15 rounded-lg flex flex-col items-center justify-center">
                  <span className="font-serif text-lg text-gold font-bold leading-none">
                    {new Date(nextMeeting.date + "T00:00:00").getDate()}
                  </span>
                  <span className="font-sans text-[10px] text-gold/70 uppercase">
                    {new Date(nextMeeting.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-serif text-lg text-charcoal leading-tight">
                    {nextMeeting.title}
                  </h3>
                  <p className="font-sans text-sm text-warm-brown/70 mt-1">
                    {formatDate(nextMeeting.date)}
                  </p>
                  <p className="font-sans text-sm text-warm-brown/70">
                    {formatTime(nextMeeting.time)}
                  </p>
                  {nextMeeting.location && (
                    <p className="font-sans text-sm text-warm-brown/50 mt-0.5">
                      {nextMeeting.location}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Link>
        ) : (
          <Link href="/calendar" className="block h-full">
            <div className="bg-white/50 rounded-xl border border-cream-dark p-6 flex flex-col items-center justify-center h-full hover:shadow-lg transition-shadow cursor-pointer">
              <p className="font-sans text-warm-brown/60 italic mb-3">
                No upcoming meetings.
              </p>
              <span className="px-5 py-2 rounded-lg bg-gold/20 text-gold font-sans text-sm">
                Schedule One
              </span>
            </div>
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">{stats.totalBooks}</p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">Books Read</p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">{stats.totalPages.toLocaleString()}</p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">Total Pages Read</p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-mahogany font-bold">{stats.totalMembers}</p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">Members</p>
        </div>
        <div className="bg-white/50 rounded-xl border border-cream-dark p-5 text-center">
          <p className="font-serif text-3xl text-gold font-bold">
            {stats.avgRating !== null ? stats.avgRating.toFixed(1) : "—"}
          </p>
          <p className="font-sans text-xs text-warm-brown/60 mt-1">Avg Rating</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/shelf"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            The Shelf
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">Browse the collection</p>
        </Link>
        <Link
          href="/calendar"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            Calendar
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">Upcoming gatherings</p>
        </Link>
        <Link
          href="/members"
          className="group bg-white/50 rounded-xl border border-cream-dark p-6 hover:border-gold/50 hover:shadow-md transition-all"
        >
          <h3 className="font-serif text-lg text-charcoal mb-1 group-hover:text-mahogany transition-colors">
            Members
          </h3>
          <p className="font-sans text-sm text-warm-brown/60">Meet the readers</p>
        </Link>
      </div>
    </div>
  );
}
