"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { Member, Book, BookComment } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { getExactPageCount, cn } from "@/lib/utils";
import BookCover from "@/components/BookCover";
import { Avatar, Button, Card, PageHeader, ScoreBadge, inputClass } from "@/components/ui";

interface RatingRow {
  member_id: string;
  book_id: string;
  pre_rating: number | null;
  post_rating: number | null;
}

interface MemberStats {
  booksRead: number;
  avgRating: number | null;
  meetingsAttended: number;
  pagesRead: number;
  scoresByBook: Record<string, number>;
}

/** One tile per finished book. Tap to drop down that member's score and take. */
function MemberBookTile({
  book,
  score,
  comment,
  open,
  onToggle,
}: {
  book: Book;
  score?: number;
  comment?: BookComment;
  open: boolean;
  onToggle: () => void;
}) {
  const hasDetail = typeof score === "number" || Boolean(comment);
  return (
    <button
      onClick={hasDetail ? onToggle : undefined}
      className={cn(
        "w-[76px] flex-shrink-0 text-left rounded-lg transition-all",
        open && "ring-2 ring-gold ring-offset-2 ring-offset-cream"
      )}
      aria-expanded={open}
    >
      <div className="relative">
        <BookCover
          book={book}
          className="w-full aspect-[2/3] rounded-md shadow-md"
          style={typeof score !== "number" ? { filter: "saturate(0.4) opacity(0.6)" } : undefined}
        />
        {typeof score === "number" && (
          <ScoreBadge score={score} size="sm" className="absolute -bottom-2 -right-2" />
        )}
      </div>
    </button>
  );
}

export default function MembersPage() {
  const { currentMember, setCurrentMember } = useMember();
  const [members, setMembers] = useState<Member[]>([]);
  const [completedBooks, setCompletedBooks] = useState<Book[]>([]);
  const [comments, setComments] = useState<BookComment[]>([]);
  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [openTile, setOpenTile] = useState<string | null>(null); // `${memberId}:${bookId}`
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [{ data: membersData }, { data: booksData }, { data: ratingsData }, commentsRes, { data: attendanceData }] =
      await Promise.all([
        supabase.from("members").select("*").order("name"),
        supabase.from("books").select("*").eq("status", "completed"),
        supabase.from("ratings").select("member_id, book_id, pre_rating, post_rating, is_visible"),
        supabase.from("book_comments").select("*"),
        supabase.from("attendance").select("member_id, status").eq("status", "going"),
      ]);

    const membersList = (membersData || []) as Member[];
    const books = (booksData || []) as Book[];
    const ratingRows = (ratingsData || []) as (RatingRow & { is_visible: boolean })[];
    const commentRows = (commentsRes.error ? [] : commentsRes.data || []) as BookComment[];

    // Club average per book, from revealed ratings, to order the shelf.
    const avgByBook: Record<string, number> = {};
    const buckets = new Map<string, number[]>();
    for (const r of ratingRows) {
      if (!r.is_visible) continue;
      const v = r.post_rating ?? r.pre_rating;
      if (v === null) continue;
      buckets.set(r.book_id, [...(buckets.get(r.book_id) || []), v]);
    }
    buckets.forEach((vals, id) => {
      avgByBook[id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    });

    books.sort((a, b) => (avgByBook[b.id] ?? -1) - (avgByBook[a.id] ?? -1));

    const attendedBy: Record<string, number> = {};
    for (const a of attendanceData || []) attendedBy[a.member_id] = (attendedBy[a.member_id] || 0) + 1;

    const statsMap: Record<string, MemberStats> = {};
    for (const m of membersList) {
      const rows = ratingRows.filter((r) => r.member_id === m.id);
      const scoresByBook: Record<string, number> = {};
      for (const r of rows) {
        const v = r.post_rating ?? r.pre_rating;
        if (v !== null) scoresByBook[r.book_id] = v;
      }
      const scores = Object.values(scoresByBook);
      const ratedIds = new Set(Object.keys(scoresByBook));
      statsMap[m.id] = {
        booksRead: ratedIds.size,
        avgRating: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
        meetingsAttended: attendedBy[m.id] || 0,
        pagesRead: books
          .filter((b) => ratedIds.has(b.id))
          .reduce((sum, b) => sum + (getExactPageCount(b) ?? 0), 0),
        scoresByBook,
      };
    }

    setMembers(membersList);
    setCompletedBooks(books);
    setComments(commentRows);
    setStats(statsMap);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddMember() {
    if (!newName.trim()) return;
    setError("");
    const { data, error: err } = await supabase
      .from("members")
      .insert({ name: newName.trim() })
      .select()
      .single();
    if (err) {
      setError(err.code === "23505" ? "That name is already taken." : "Something went wrong.");
      return;
    }
    if (data) {
      setNewName("");
      setIsAdding(false);
      setCurrentMember(data);
      load();
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="The Clerb" title="Members" subtitle={`${members.length} in the club`} />

      <div className="space-y-3 mb-8">
        {members.map((member) => {
          const s = stats[member.id];
          const isYou = currentMember?.id === member.id;
          const isOpen = expandedMember === member.id;

          return (
            <Card key={member.id} padded={false} className={cn(isYou && "border-gold/40")}>
              <button
                onClick={() => {
                  setExpandedMember(isOpen ? null : member.id);
                  setOpenTile(null);
                }}
                className="w-full flex items-center gap-4 p-4 sm:p-5 text-left"
                aria-expanded={isOpen}
              >
                <Avatar name={member.name} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-lg text-charcoal leading-tight">{member.name}</p>
                  {isYou && <p className="font-sans text-xs text-gold mt-0.5">That&apos;s you</p>}
                </div>

                {s && (
                  <div className="flex items-center gap-4 sm:gap-6">
                    <div className="text-center">
                      <p className="font-sans text-lg font-semibold tabular-nums text-charcoal leading-none">
                        {s.booksRead}
                      </p>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-warm-brown/60 mt-1">
                        Rated
                      </p>
                    </div>
                    <div className="text-center">
                      {s.avgRating !== null ? (
                        <ScoreBadge score={s.avgRating} size="md" />
                      ) : (
                        <p className="font-sans text-lg text-warm-brown/40 leading-none">—</p>
                      )}
                      <p className="font-sans text-[10px] uppercase tracking-wider text-warm-brown/60 mt-1">
                        Avg
                      </p>
                    </div>
                    <div className="text-center hidden sm:block">
                      <p className="font-sans text-lg font-semibold tabular-nums text-charcoal leading-none">
                        {s.meetingsAttended}
                      </p>
                      <p className="font-sans text-[10px] uppercase tracking-wider text-warm-brown/60 mt-1">
                        Met
                      </p>
                    </div>
                  </div>
                )}

                <svg
                  className={cn("w-4 h-4 text-warm-brown/50 flex-shrink-0 transition-transform", isOpen && "rotate-180")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isOpen && s && (
                <div className="expand-in border-t border-charcoal/[0.06] px-4 sm:px-5 pb-5 pt-4">
                  <p className="font-sans text-xs text-warm-brown mb-4">
                    {s.pagesRead.toLocaleString()} pages read · {s.meetingsAttended} meeting
                    {s.meetingsAttended === 1 ? "" : "s"}
                  </p>

                  {completedBooks.length === 0 ? (
                    <p className="font-sans text-sm text-warm-brown/60">No finished books yet.</p>
                  ) : (
                    <>
                      <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
                        {completedBooks.map((book) => {
                          const key = `${member.id}:${book.id}`;
                          return (
                            <MemberBookTile
                              key={book.id}
                              book={book}
                              score={s.scoresByBook[book.id]}
                              comment={comments.find(
                                (c) => c.member_id === member.id && c.book_id === book.id
                              )}
                              open={openTile === key}
                              onToggle={() => setOpenTile(openTile === key ? null : key)}
                            />
                          );
                        })}
                      </div>

                      {openTile?.startsWith(`${member.id}:`) &&
                        (() => {
                          const bookId = openTile.split(":")[1];
                          const book = completedBooks.find((b) => b.id === bookId);
                          const score = s.scoresByBook[bookId];
                          const comment = comments.find(
                            (c) => c.member_id === member.id && c.book_id === bookId
                          );
                          if (!book) return null;
                          return (
                            <div className="expand-in mt-2 rounded-xl bg-charcoal/[0.04] px-4 py-3.5 flex gap-4">
                              <div className="min-w-0 flex-1">
                                <Link
                                  href={`/book/${book.id}`}
                                  className="font-serif text-[15px] text-charcoal hover:text-mahogany leading-snug"
                                >
                                  {book.title}
                                </Link>
                                {comment ? (
                                  <p className="font-serif text-[15px] text-charcoal/85 italic leading-relaxed mt-1.5">
                                    &ldquo;{comment.content}&rdquo;
                                  </p>
                                ) : (
                                  <p className="font-sans text-xs text-warm-brown/60 mt-1.5">
                                    {member.name.split(" ")[0]} didn&apos;t leave a note on this one.
                                  </p>
                                )}
                              </div>
                              {typeof score === "number" && <ScoreBadge score={score} size="lg" />}
                            </div>
                          );
                        })()}
                    </>
                  )}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-brown mb-4">
          Join the club
        </p>
        {!isAdding ? (
          <Button variant="secondary" className="w-full" onClick={() => setIsAdding(true)}>
            Add yourself
          </Button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              placeholder="Your name"
              className={inputClass}
              autoFocus
            />
            {error && <p className="font-sans text-sm text-red-700">{error}</p>}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setIsAdding(false);
                  setNewName("");
                  setError("");
                }}
              >
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleAddMember}>
                Join
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
