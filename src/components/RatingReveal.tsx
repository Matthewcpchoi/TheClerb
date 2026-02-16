"use client";

import { Rating } from "@/types";
import { getInitials, getAvatarColor } from "@/lib/utils";

interface RatingRevealProps {
  ratings: Rating[];
  currentMemberId: string | null;
  onToggleVisibility: (ratingId: string, isVisible: boolean) => void;
}

export default function RatingReveal({
  ratings,
  currentMemberId,
  onToggleVisibility,
}: RatingRevealProps) {
  const visibleRatings = ratings.filter((r) => r.is_visible);
  const avgPre =
    visibleRatings.filter((r) => r.pre_rating !== null).length > 0
      ? visibleRatings
          .filter((r) => r.pre_rating !== null)
          .reduce((sum, r) => sum + (r.pre_rating || 0), 0) /
        visibleRatings.filter((r) => r.pre_rating !== null).length
      : null;
  const avgPost =
    visibleRatings.filter((r) => r.post_rating !== null).length > 0
      ? visibleRatings
          .filter((r) => r.post_rating !== null)
          .reduce((sum, r) => sum + (r.post_rating || 0), 0) /
        visibleRatings.filter((r) => r.post_rating !== null).length
      : null;

  return (
    <div className="space-y-4">
      {/* Averages */}
      {(avgPre !== null || avgPost !== null) && (
        <div className="flex gap-6 mb-4">
          {avgPre !== null && (
            <div>
              <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider">
                Avg Pre-Rating
              </p>
              <p className="font-serif text-2xl text-mahogany font-bold">
                {avgPre.toFixed(1)}
              </p>
            </div>
          )}
          {avgPost !== null && (
            <div>
              <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider">
                Avg Post-Rating
              </p>
              <p className="font-serif text-2xl text-gold font-bold">
                {avgPost.toFixed(1)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Dot plot visualization */}
      {visibleRatings.length > 0 && (
        <div className="bg-cream-dark/50 rounded-lg p-4">
          <p className="font-sans text-xs text-warm-brown/60 uppercase tracking-wider mb-3">
            Rating Distribution
          </p>
          <div className="relative h-12">
            {/* Scale line */}
            <div className="absolute top-1/2 left-0 right-0 h-px bg-warm-brown/20" />
            {/* Scale markers */}
            {[0, 2, 4, 6, 8, 10].map((n) => (
              <div
                key={n}
                className="absolute top-1/2 w-px h-3 bg-warm-brown/30 -translate-y-1/2"
                style={{ left: `${(n / 10) * 100}%` }}
              >
                <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] font-sans text-warm-brown/40">
                  {n}
                </span>
              </div>
            ))}
            {/* Rating dots */}
            {visibleRatings
              .filter((r) => r.pre_rating !== null)
              .map((rating) => (
                <div
                  key={rating.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${((rating.pre_rating || 0) / 10) * 100}%` }}
                  title={`${rating.member?.name || "Member"}: ${rating.pre_rating}`}
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-cream border-2 border-cream"
                    style={{
                      backgroundColor: getAvatarColor(
                        rating.member?.name || "?"
                      ),
                    }}
                  >
                    {getInitials(rating.member?.name || "?")}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Individual ratings */}
      <div className="space-y-2">
        {ratings.map((rating) => {
          const isOwn = rating.member_id === currentMemberId;
          const visible = rating.is_visible || isOwn;

          return (
            <div
              key={rating.id}
              className="flex items-center justify-between py-2 px-3 rounded-lg bg-cream-dark/30"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-cream text-xs font-semibold"
                  style={{
                    backgroundColor: getAvatarColor(
                      rating.member?.name || "?"
                    ),
                  }}
                >
                  {getInitials(rating.member?.name || "?")}
                </div>
                <span className="font-sans text-sm text-charcoal">
                  {rating.member?.name || "Member"}
                </span>
              </div>

              {visible ? (
                <div className="flex items-center gap-4">
                  {rating.pre_rating !== null && (
                    <div className="text-right">
                      <p className="text-[10px] font-sans text-warm-brown/60">
                        Pre
                      </p>
                      <p className="font-serif text-sm text-mahogany font-bold">
                        {rating.pre_rating.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {rating.post_rating !== null && (
                    <div className="text-right">
                      <p className="text-[10px] font-sans text-warm-brown/60">
                        Post
                      </p>
                      <p className="font-serif text-sm text-gold font-bold">
                        {rating.post_rating.toFixed(1)}
                      </p>
                    </div>
                  )}
                  {isOwn && (
                    <button
                      onClick={() =>
                        onToggleVisibility(rating.id, !rating.is_visible)
                      }
                      className={`ml-2 px-2 py-1 rounded text-xs font-sans transition-colors ${
                        rating.is_visible
                          ? "bg-sage/20 text-sage"
                          : "bg-gold/20 text-gold"
                      }`}
                    >
                      {rating.is_visible ? "Visible (click to hide)" : "Hidden (click to reveal)"}
                    </button>
                  )}
                </div>
              ) : (
                <span className="font-sans text-xs text-warm-brown/40 italic">
                  Hidden
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
