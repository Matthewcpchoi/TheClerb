"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Member, Book } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { getInitials, getAvatarColor, getExactPageCount, getBookCoverCandidates } from "@/lib/utils";

interface MemberRatingRow {
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

async function fetchMemberStats(members: Member[], completedBooks: Book[]) {
  const statsMap: Record<string, MemberStats> = {};

  const { data: ratings } = await supabase
    .from("ratings")
    .select("member_id, book_id, pre_rating, post_rating");

  const ratingRows = (ratings || []) as MemberRatingRow[];

  const memberRatingMap: Record<string, MemberRatingRow[]> = {};
  for (const row of ratingRows) {
    if (!memberRatingMap[row.member_id]) memberRatingMap[row.member_id] = [];
    memberRatingMap[row.member_id].push(row);
  }

  for (const member of members) {
    const rows = memberRatingMap[member.id] || [];
    const scoreRows = rows
      .map((r) => ({ ...r, score: r.post_rating ?? r.pre_rating }))
      .filter((r): r is MemberRatingRow & { score: number } => r.score !== null);

    const scoresByBook: Record<string, number> = {};
    for (const row of scoreRows) {
      scoresByBook[row.book_id] = row.score;
    }

    const ratedBookIds = new Set(scoreRows.map((r) => r.book_id));
    const pagesRead = completedBooks
      .filter((b) => ratedBookIds.has(b.id))
      .reduce((sum, b) => sum + (getExactPageCount(b) ?? 0), 0);

    const { count: attended } = await supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("status", "going");


    statsMap[member.id] = {
      booksRead: ratedBookIds.size,
      avgRating:
        scoreRows.length > 0
          ? scoreRows.reduce((a, b) => a + b.score, 0) / scoreRows.length
          : null,
      meetingsAttended: attended || 0,
      pagesRead,
      scoresByBook,
    };
  }

  return statsMap;
}

async function fetchCompletedBooksSortedByShelfOrder() {
  const { data: completedBooksData } = await supabase
    .from("books")
    .select("*")
    .eq("status", "completed");

  const completedBooks = (completedBooksData || []) as Book[];
  if (completedBooks.length === 0) return [] as Book[];

  const { data: visibleRatings } = await supabase
    .from("ratings")
    .select("book_id, pre_rating, post_rating")
    .eq("is_visible", true);

  const avgByBook: Record<string, number> = {};
  for (const book of completedBooks) {
    const rows = (visibleRatings || []).filter((r) => r.book_id === book.id);
    const vals = rows
      .map((r) => r.post_rating ?? r.pre_rating)
      .filter((v): v is number => v !== null);
    if (vals.length > 0) {
      avgByBook[book.id] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
  }

  return completedBooks.sort((a, b) => {
    const aScore = avgByBook[a.id];
    const bScore = avgByBook[b.id];
    if (aScore === undefined && bScore === undefined) return 0;
    if (aScore === undefined) return 1;
    if (bScore === undefined) return -1;
    return bScore - aScore;
  });
}

function MemberBookTile({
  book,
  score,
}: {
  book: Book;
  score: number | undefined;
}) {
  const imageSources = getBookCoverCandidates(book);
  const [imageIndex, setImageIndex] = useState(0);
  const imageSrc = imageSources[imageIndex] || "";

  return (
    <div className="text-center w-24 flex-shrink-0">
      <div
        className="relative transition-transform duration-200 hover:-translate-y-1 mx-auto"
        style={{ transform: "perspective(400px) rotateY(-3deg)", transformOrigin: "left center" }}
      >
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={book.title}
            className="w-24 h-36 object-cover rounded shadow-lg"
            referrerPolicy="no-referrer"
            onError={() => setImageIndex((prev) => prev + 1)}
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
      <p className="font-serif text-sm text-charcoal mt-2 truncate">{book.title}</p>
      <p className="font-sans text-xs text-gold mt-0.5 font-semibold">
        {score !== undefined ? `★ ${score.toFixed(1)}` : "—"}
      </p>
    </div>
  );
}

export default function MembersPage() {
  const { currentMember, setCurrentMember } = useMember();
  const [members, setMembers] = useState<Member[]>([]);
  const [completedBooks, setCompletedBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchMembers = useCallback(async () => {
    const { data: membersData } = await supabase.from("members").select("*").order("name");
    const shelfBooks = await fetchCompletedBooksSortedByShelfOrder();

    if (membersData) {
      setMembers(membersData);
      setCompletedBooks(shelfBooks);
      const s = await fetchMemberStats(membersData, shelfBooks);
      setStats(s);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  async function handleAddMember() {
    if (!newName.trim()) return;
    setError("");

    const { data, error: err } = await supabase
      .from("members")
      .insert({ name: newName.trim() })
      .select()
      .single();

    if (err) {
      if (err.code === "23505") {
        setError("That name is already taken.");
      } else {
        setError("Something went wrong.");
      }
      return;
    }

    if (data) {
      setNewName("");
      setIsAdding(false);
      setCurrentMember(data);
      fetchMembers();
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl text-charcoal">Members</h1>
          <p className="font-sans text-sm text-warm-brown/60 mt-1">The readers of The Clerb</p>
        </div>
      </div>

      <div className="space-y-3 mb-8">
        {members.map((member) => {
          const memberStats = stats[member.id];
          const isCurrentUser = currentMember?.id === member.id;
          const isExpanded = expandedMemberId === member.id;

          return (
            <div
              key={member.id}
              className={`bg-white/50 rounded-xl border p-5 transition-all ${
                isCurrentUser ? "border-gold/50 shadow-sm" : "border-cream-dark"
              }`}
            >
              <button
                onClick={() => setExpandedMemberId(isExpanded ? null : member.id)}
                className="w-full flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-cream font-bold text-lg"
                    style={{ backgroundColor: getAvatarColor(member.name) }}
                  >
                    {getInitials(member.name)}
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-charcoal">{member.name}</h3>
                    {isCurrentUser && <span className="font-sans text-xs text-gold">That&apos;s you</span>}
                  </div>
                </div>

                <div className="flex items-center gap-5 text-center">
                  {memberStats && (
                    <>
                      <div>
                        <p className="font-serif text-lg text-mahogany font-bold">{memberStats.booksRead}</p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">Rated</p>
                      </div>
                      <div>
                        <p className="font-serif text-lg text-gold font-bold">
                          {memberStats.avgRating !== null ? memberStats.avgRating.toFixed(1) : "—"}
                        </p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">Avg</p>
                      </div>
                      <div>
                        <p className="font-serif text-lg text-sage font-bold">{memberStats.meetingsAttended}</p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">Attended</p>
                      </div>
                    </>
                  )}
                  <span className="font-sans text-xs text-warm-brown/60">{isExpanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {isExpanded && memberStats && (
                <div className="mt-4 pt-4 border-t border-cream-dark/80">
                  <p className="font-sans text-xs text-warm-brown/70 mb-3">
                    Pages Read: <span className="font-semibold text-charcoal">{memberStats.pagesRead.toLocaleString()}</span>
                  </p>

                  {completedBooks.length === 0 ? (
                    <p className="font-sans text-sm text-warm-brown/60 italic">No completed books yet.</p>
                  ) : (
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                      {completedBooks.map((book) => (
                        <MemberBookTile key={`${member.id}-${book.id}`} book={book} score={memberStats.scoresByBook[book.id]} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-white/50 rounded-xl border border-cream-dark p-6">
        <h2 className="font-serif text-lg text-charcoal mb-4">Join The Clerb</h2>
        {!isAdding ? (
          <button
            onClick={() => setIsAdding(true)}
            className="w-full py-3 rounded-lg border-2 border-dashed border-gold/40 text-gold font-sans text-sm hover:border-gold hover:bg-gold/5 transition-all"
          >
            Add Yourself
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
              placeholder="Your name"
              className="w-full px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              autoFocus
            />
            {error && <p className="text-sm text-red-700 font-sans">{error}</p>}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setIsAdding(false);
                  setNewName("");
                  setError("");
                }}
                className="flex-1 py-2 rounded-lg border border-cream-dark text-warm-brown font-sans text-sm hover:bg-cream-dark transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddMember}
                className="flex-1 py-2 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors"
              >
                Join
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
