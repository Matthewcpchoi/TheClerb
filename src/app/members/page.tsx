"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { Member } from "@/types";
import { useMember } from "@/components/MemberProvider";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface MemberBook {
  id: string;
  title: string;
  page_count: number | null;
  rating: number;
}

interface MemberStats {
  booksRead: number;
  avgRating: number | null;
  meetingsAttended: number;
  totalPagesRead: number;
  books: MemberBook[];
}

async function fetchStatsForMembers(membersList: Member[]) {
  const statsMap: Record<string, MemberStats> = {};

  for (const member of membersList) {
    const { data: ratings } = await supabase
      .from("ratings")
      .select("pre_rating, post_rating, book:books(id, title, page_count)")
      .eq("member_id", member.id);

    const ratedBooks: MemberBook[] = (ratings || [])
      .map((r) => {
        const score = r.post_rating ?? r.pre_rating;
        const rawBook = Array.isArray(r.book) ? r.book[0] : r.book;
        if (score === null || !rawBook) return null;
        const book = rawBook as { id: string; title: string; page_count: number | null };
        return {
          id: book.id,
          title: book.title,
          page_count: book.page_count,
          rating: score,
        };
      })
      .filter((v): v is MemberBook => v !== null)
      .sort((a, b) => b.rating - a.rating);

    const ratingVals = ratedBooks.map((b) => b.rating);

    const { count: attended } = await supabase
      .from("attendance")
      .select("*", { count: "exact", head: true })
      .eq("member_id", member.id)
      .eq("status", "going");

    const uniqueBooks = new Map<string, MemberBook>();
    for (const b of ratedBooks) {
      if (!uniqueBooks.has(b.id)) uniqueBooks.set(b.id, b);
    }
    const totalPagesRead = Array.from(uniqueBooks.values()).reduce(
      (sum, b) => sum + (b.page_count || 0),
      0
    );

    statsMap[member.id] = {
      booksRead: ratingVals.length,
      avgRating:
        ratingVals.length > 0
          ? ratingVals.reduce((a, b) => a + b, 0) / ratingVals.length
          : null,
      meetingsAttended: attended || 0,
      totalPagesRead,
      books: ratedBooks,
    };
  }

  return statsMap;
}

export default function MembersPage() {
  const { currentMember, setCurrentMember } = useMember();
  const [members, setMembers] = useState<Member[]>([]);
  const [stats, setStats] = useState<Record<string, MemberStats>>({});
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState("");

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase.from("members").select("*").order("name");
    if (data) {
      setMembers(data);
      const s = await fetchStatsForMembers(data);
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
          <p className="font-sans text-sm text-warm-brown/60 mt-1">
            The readers of The Clerb
          </p>
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
                    {isCurrentUser && (
                      <span className="font-sans text-xs text-gold">That&apos;s you</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 text-center">
                  {memberStats && (
                    <>
                      <div>
                        <p className="font-serif text-lg text-mahogany font-bold">
                          {memberStats.booksRead}
                        </p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">
                          Rated
                        </p>
                      </div>
                      <div>
                        <p className="font-serif text-lg text-gold font-bold">
                          {memberStats.avgRating !== null
                            ? memberStats.avgRating.toFixed(1)
                            : "—"}
                        </p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">
                          Avg
                        </p>
                      </div>
                      <div>
                        <p className="font-serif text-lg text-sage font-bold">
                          {memberStats.totalPagesRead.toLocaleString()}
                        </p>
                        <p className="font-sans text-[10px] text-warm-brown/60 uppercase tracking-wider">
                          Pages
                        </p>
                      </div>
                    </>
                  )}
                  <span className="font-sans text-xs text-warm-brown/60">
                    {isExpanded ? "▲" : "▼"}
                  </span>
                </div>
              </button>

              {isExpanded && memberStats && (
                <div className="mt-4 pt-4 border-t border-cream-dark/80">
                  <div className="flex flex-wrap gap-4 mb-3">
                    <p className="font-sans text-xs text-warm-brown/70">
                      Meetings attended: <span className="font-semibold text-charcoal">{memberStats.meetingsAttended}</span>
                    </p>
                    <p className="font-sans text-xs text-warm-brown/70">
                      Total pages read: <span className="font-semibold text-charcoal">{memberStats.totalPagesRead.toLocaleString()}</span>
                    </p>
                  </div>
                  <h4 className="font-serif text-base text-charcoal mb-2">
                    Books (highest score to lowest)
                  </h4>
                  {memberStats.books.length === 0 ? (
                    <p className="font-sans text-sm text-warm-brown/60 italic">No ratings yet.</p>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {memberStats.books.map((book) => (
                        <div
                          key={`${member.id}-${book.id}`}
                          className="min-w-[180px] rounded-lg border border-cream-dark bg-cream/50 p-3"
                        >
                          <p className="font-serif text-sm text-charcoal truncate">{book.title}</p>
                          <p className="font-sans text-xs text-gold mt-1">Rating: {book.rating.toFixed(1)}</p>
                          <p className="font-sans text-xs text-warm-brown/70 mt-0.5">
                            {book.page_count !== null ? `${book.page_count} pages` : "Pages unknown"}
                          </p>
                        </div>
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
