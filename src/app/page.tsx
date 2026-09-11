"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Book, Meeting } from "@/types";
import { formatDate, formatTime, getExactPageCount } from "@/lib/utils";
import BookCover from "@/components/BookCover";
import { Card, LinkButton, ScoreBadge, SectionTitle, StatusPill } from "@/components/ui";

interface Stats {
  totalBooks: number;
  totalMembers: number;
  avgRating: number | null;
  totalPages: number | null;
}

export default function Home() {
  const [currentBook, setCurrentBook] = useState<Book | null>(null);
  const [currentScore, setCurrentScore] = useState<number | null>(null);
  const [nextMeeting, setNextMeeting] = useState<Meeting | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];

      const [{ data: reading }, { data: meetings }, { data: completed }, { count: memberCount }, { data: ratings }] =
        await Promise.all([
          supabase.from("books").select("*").eq("status", "reading").limit(1).maybeSingle(),
          supabase
            .from("meetings")
            .select("*, book:books(*)")
            .gte("date", today)
            .order("date", { ascending: true })
            .order("time", { ascending: true })
            .limit(1),
          supabase.from("books").select("*").eq("status", "completed"),
          supabase.from("members").select("*", { count: "exact", head: true }),
          supabase.from("ratings").select("book_id, pre_rating, post_rating").eq("is_visible", true),
        ]);

      if (reading) setCurrentBook(reading);
      if (meetings && meetings.length > 0) setNextMeeting(meetings[0]);

      const vals = (ratings || [])
        .map((r) => r.post_rating ?? r.pre_rating)
        .filter((v): v is number => v !== null);

      if (reading) {
        const mine = (ratings || [])
          .filter((r) => r.book_id === reading.id)
          .map((r) => r.post_rating ?? r.pre_rating)
          .filter((v): v is number => v !== null);
        if (mine.length) setCurrentScore(mine.reduce((a, b) => a + b, 0) / mine.length);
      }

      const pageValues = (completed || [])
        .map((b) => getExactPageCount(b))
        .filter((v): v is number => typeof v === "number");

      setStats({
        totalBooks: (completed || []).length,
        totalMembers: memberCount || 0,
        avgRating: vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null,
        totalPages: pageValues.length ? pageValues.reduce((a, b) => a + b, 0) : null,
      });
    })();
  }, []);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="pt-2 pb-10 sm:pt-6 sm:pb-14">
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold mb-3">
          Book club
        </p>
        <h1 className="font-serif text-5xl sm:text-6xl text-charcoal tracking-tight leading-none">
          The Clerb
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
        {/* Currently reading — hero */}
        <Card className="md:col-span-3 overflow-hidden" padded={false}>
          {currentBook ? (
            <Link href={`/book/${currentBook.id}`} className="flex gap-5 sm:gap-7 p-5 sm:p-7 group">
              <div className="relative flex-shrink-0">
                <BookCover
                  book={currentBook}
                  className="w-28 sm:w-36 aspect-[2/3] rounded-lg shadow-[0_4px_8px_rgba(43,38,34,0.15),0_20px_40px_-16px_rgba(43,38,34,0.45)] transition-transform group-hover:-translate-y-1"
                  eager
                />
                {currentScore !== null && (
                  <ScoreBadge score={currentScore} size="lg" className="absolute -bottom-3 -right-3" />
                )}
              </div>
              <div className="min-w-0 flex-1 flex flex-col">
                <StatusPill status="reading" />
                <h2 className="font-serif text-2xl sm:text-3xl text-charcoal leading-tight tracking-tight mt-3 group-hover:text-mahogany transition-colors">
                  {currentBook.title}
                </h2>
                {currentBook.author && (
                  <p className="font-sans text-sm sm:text-base text-warm-brown mt-1.5">{currentBook.author}</p>
                )}
                <p className="font-sans text-xs text-gold mt-auto pt-4">Rate &amp; discuss →</p>
              </div>
            </Link>
          ) : (
            <div className="p-7 flex flex-col items-start gap-4">
              <StatusPill status="reading" />
              <p className="font-serif text-xl text-charcoal">Nothing on the go right now.</p>
              <LinkButton href="/shelf" variant="secondary">
                Pick the next book
              </LinkButton>
            </div>
          )}
        </Card>

        {/* Next meeting */}
        <Card className="md:col-span-2" padded={false}>
          {nextMeeting ? (
            <Link href="/calendar" className="block p-5 sm:p-6 h-full group">
              <SectionTitle>Next meeting</SectionTitle>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-14 rounded-xl bg-gold/15 py-2 text-center">
                  <p className="font-sans text-2xl font-semibold text-[#8a6a22] leading-none tabular-nums">
                    {new Date(nextMeeting.date + "T00:00:00").getDate()}
                  </p>
                  <p className="font-sans text-[10px] uppercase tracking-wider text-[#8a6a22]/80 mt-1">
                    {new Date(nextMeeting.date + "T00:00:00").toLocaleDateString("en-US", { month: "short" })}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="font-serif text-lg text-charcoal leading-snug group-hover:text-mahogany transition-colors">
                    {nextMeeting.title}
                  </p>
                  <p className="font-sans text-sm text-warm-brown mt-1">
                    {formatDate(nextMeeting.date).split(",")[0]} · {formatTime(nextMeeting.time)}
                  </p>
                  {nextMeeting.location && (
                    <p className="font-sans text-xs text-warm-brown/60 mt-0.5 truncate">{nextMeeting.location}</p>
                  )}
                </div>
              </div>
            </Link>
          ) : (
            <Link href="/calendar" className="block p-5 sm:p-6 h-full group">
              <SectionTitle>Next meeting</SectionTitle>
              <p className="font-serif text-lg text-charcoal">Nothing scheduled.</p>
              <p className="font-sans text-xs text-gold mt-3 group-hover:underline">Schedule one →</p>
            </Link>
          )}
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Books finished" value={stats ? String(stats.totalBooks) : "—"} />
        <Stat label="Pages read" value={stats?.totalPages ? stats.totalPages.toLocaleString() : "—"} />
        <Stat label="Members" value={stats ? String(stats.totalMembers) : "—"} />
        <Card className="flex flex-col items-center justify-center py-5">
          {stats?.avgRating !== null && stats?.avgRating !== undefined ? (
            <ScoreBadge score={stats.avgRating} size="lg" />
          ) : (
            <p className="font-sans text-3xl text-warm-brown/40 leading-none">—</p>
          )}
          <p className="font-sans text-[11px] uppercase tracking-wider text-warm-brown/70 mt-3">
            Club average
          </p>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="flex flex-col items-center justify-center py-5">
      <p className="font-serif text-4xl text-charcoal leading-none tabular-nums">{value}</p>
      <p className="font-sans text-[11px] uppercase tracking-wider text-warm-brown/70 mt-3">{label}</p>
    </Card>
  );
}
