"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Book, Rating, DiscussionTopic } from "@/types";
import { useMember } from "@/components/MemberProvider";
import RatingSlider from "@/components/RatingSlider";
import RatingReveal from "@/components/RatingReveal";
import DiscussionTopics from "@/components/DiscussionTopics";
import Link from "next/link";

export default function BookDetailPage() {
  const params = useParams();
  const bookId = params.id as string;
  const { currentMember } = useMember();

  const [book, setBook] = useState<Book | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [topics, setTopics] = useState<DiscussionTopic[]>([]);
  const [myRating, setMyRating] = useState<Rating | null>(null);
  const [showPostRating, setShowPostRating] = useState(false);
  const [postReason, setPostReason] = useState("");
  const [description, setDescription] = useState("");

  const fetchBook = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .eq("id", bookId)
      .single();
    if (data) {
      setBook(data);
      // Fetch description from Google Books if we have the ID
      if (data.google_books_id) {
        try {
          const res = await fetch(
            `https://www.googleapis.com/books/v1/volumes/${data.google_books_id}`
          );
          const json = await res.json();
          if (json.volumeInfo?.description) {
            setDescription(json.volumeInfo.description);
          }
        } catch {
          // Ignore
        }
      }
    }
  }, [bookId]);

  const fetchRatings = useCallback(async () => {
    const { data } = await supabase
      .from("ratings")
      .select("*, member:members(*)")
      .eq("book_id", bookId);
    if (data) {
      setRatings(data);
      if (currentMember) {
        const mine = data.find((r) => r.member_id === currentMember.id);
        if (mine) setMyRating(mine);
      }
    }
  }, [bookId, currentMember]);

  const fetchTopics = useCallback(async () => {
    const { data } = await supabase
      .from("discussion_topics")
      .select("*, member:members(*)")
      .eq("book_id", bookId)
      .order("created_at", { ascending: true });
    if (data) setTopics(data);
  }, [bookId]);

  useEffect(() => {
    fetchBook();
    fetchRatings();
    fetchTopics();
  }, [fetchBook, fetchRatings, fetchTopics]);

  // Real-time subscription for ratings
  useEffect(() => {
    const channel = supabase
      .channel(`ratings-${bookId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ratings",
          filter: `book_id=eq.${bookId}`,
        },
        () => {
          fetchRatings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookId, fetchRatings]);

  async function handlePreRating(value: number) {
    if (!currentMember) return;

    const { data } = await supabase
      .from("ratings")
      .upsert(
        {
          book_id: bookId,
          member_id: currentMember.id,
          pre_rating: value,
          is_visible: false,
        },
        { onConflict: "book_id,member_id" }
      )
      .select("*, member:members(*)")
      .single();

    if (data) {
      setMyRating(data);
      fetchRatings();
    }
  }

  async function handlePostRating(value: number) {
    if (!currentMember || !myRating) return;

    await supabase
      .from("ratings")
      .update({
        post_rating: value,
        rating_change_reason: postReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", myRating.id);

    setShowPostRating(false);
    setPostReason("");
    fetchRatings();
  }

  async function handleToggleVisibility(ratingId: string, isVisible: boolean) {
    await supabase
      .from("ratings")
      .update({ is_visible: isVisible })
      .eq("id", ratingId);
    fetchRatings();
  }

  async function handleAddTopic(content: string) {
    if (!currentMember) return;
    await supabase.from("discussion_topics").insert({
      book_id: bookId,
      member_id: currentMember.id,
      content,
      is_spoiler: true,
    });
    fetchTopics();
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="font-serif text-xl text-warm-brown/40 animate-pulse">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Back link */}
      <Link
        href="/shelf"
        className="inline-flex items-center gap-1 font-sans text-sm text-warm-brown hover:text-mahogany transition-colors mb-6"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Shelf
      </Link>

      {/* Book Header */}
      <div className="flex flex-col md:flex-row items-start gap-8 mb-10">
        {(book.cover_url || book.thumbnail_url) && (
          <img
            src={book.cover_url || book.thumbnail_url || ""}
            alt={book.title}
            className="w-48 h-72 object-cover rounded-lg shadow-xl flex-shrink-0"
          />
        )}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span
              className={`px-2 py-0.5 rounded text-xs font-sans ${
                book.status === "reading"
                  ? "bg-sage/20 text-sage"
                  : book.status === "completed"
                    ? "bg-gold/20 text-gold"
                    : "bg-cream-dark text-warm-brown/60"
              }`}
            >
              {book.status === "reading"
                ? "Currently Reading"
                : book.status === "completed"
                  ? "Completed"
                  : "Upcoming"}
            </span>
          </div>
          <h1 className="font-serif text-3xl md:text-4xl text-charcoal mb-2">
            {book.title}
          </h1>
          {book.author && (
            <p className="font-sans text-lg text-warm-brown mb-4">
              {book.author}
            </p>
          )}
          {description && (
            <div
              className="font-sans text-sm text-charcoal/70 leading-relaxed line-clamp-6"
              dangerouslySetInnerHTML={{ __html: description }}
            />
          )}
        </div>
      </div>

      {/* Ratings Section */}
      <div className="bg-white/50 rounded-xl border border-cream-dark p-6 mb-6">
        <h2 className="font-serif text-xl text-charcoal mb-6">Ratings</h2>

        {/* My rating */}
        {currentMember && !myRating && (
          <div className="mb-6 p-4 rounded-lg bg-cream-dark/30">
            <RatingSlider
              label="Your Pre-Club Rating"
              onSubmit={handlePreRating}
            />
          </div>
        )}

        {currentMember && myRating && !myRating.post_rating && (
          <div className="mb-6">
            <div className="flex items-center justify-between p-3 rounded-lg bg-cream-dark/30 mb-3">
              <div>
                <p className="font-sans text-xs text-warm-brown/60">
                  Your Pre-Club Rating
                </p>
                <p className="font-serif text-xl text-mahogany font-bold">
                  {myRating.pre_rating?.toFixed(2)}
                </p>
              </div>
              <button
                onClick={() =>
                  handleToggleVisibility(myRating.id, !myRating.is_visible)
                }
                className={`px-3 py-1.5 rounded text-xs font-sans transition-colors ${
                  myRating.is_visible
                    ? "bg-sage/20 text-sage"
                    : "bg-gold/20 text-gold"
                }`}
              >
                {myRating.is_visible
                  ? "Rating Visible"
                  : "Make Rating Visible"}
              </button>
            </div>

            {book.status === "completed" && (
              <>
                {!showPostRating ? (
                  <button
                    onClick={() => setShowPostRating(true)}
                    className="w-full py-2.5 rounded-lg border border-gold text-gold font-sans text-sm hover:bg-gold/10 transition-colors"
                  >
                    Add Post-Club Rating
                  </button>
                ) : (
                  <div className="p-4 rounded-lg bg-cream-dark/30 space-y-4">
                    <RatingSlider
                      label="Your Post-Club Rating"
                      onSubmit={handlePostRating}
                    />
                    <textarea
                      value={postReason}
                      onChange={(e) => setPostReason(e.target.value)}
                      placeholder="What changed your mind? (optional)"
                      className="w-full px-4 py-2 rounded-lg border border-cream-dark bg-white font-sans text-sm text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold resize-none"
                      rows={2}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {currentMember && myRating && myRating.post_rating !== null && (
          <div className="mb-6 p-3 rounded-lg bg-cream-dark/30">
            <div className="flex items-center gap-6">
              <div>
                <p className="font-sans text-xs text-warm-brown/60">Pre</p>
                <p className="font-serif text-xl text-mahogany font-bold">
                  {myRating.pre_rating?.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="font-sans text-xs text-warm-brown/60">Post</p>
                <p className="font-serif text-xl text-gold font-bold">
                  {myRating.post_rating?.toFixed(2)}
                </p>
              </div>
            </div>
            {myRating.rating_change_reason && (
              <p className="font-sans text-sm text-charcoal/70 mt-2 italic">
                &ldquo;{myRating.rating_change_reason}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* All Ratings */}
        <RatingReveal
          ratings={ratings}
          currentMemberId={currentMember?.id || null}
          onToggleVisibility={handleToggleVisibility}
        />
      </div>

      {/* Discussion Topics */}
      <div className="bg-white/50 rounded-xl border border-cream-dark p-6">
        <DiscussionTopics
          topics={topics}
          bookId={bookId}
          memberId={currentMember?.id || null}
          onAddTopic={handleAddTopic}
        />
      </div>
    </div>
  );
}
