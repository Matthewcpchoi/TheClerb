"use client";

import { useState } from "react";
import { BookComment, Rating } from "@/types";
import { Avatar, ScoreBadge, scoreTone } from "./ui";
import { cn } from "@/lib/utils";

interface ClubRatingsProps {
  ratings: Rating[];
  comments: BookComment[];
  currentMemberId: string | null;
}

function currentScore(r: Rating): number | null {
  return r.post_rating ?? r.pre_rating;
}

/**
 * Everyone's ratings, with a distribution strip and one expandable row per
 * member. Expanding a row shows their comment and, if they revised their
 * score after the club met, the original and why.
 */
export default function ClubRatings({ ratings, comments, currentMemberId }: ClubRatingsProps) {
  const [open, setOpen] = useState<string | null>(null);

  const visible = ratings.filter((r) => r.is_visible && currentScore(r) !== null);
  const scores = visible.map((r) => currentScore(r) as number);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const commentByMember = new Map(comments.map((c) => [c.member_id, c]));

  // Members with a rating first (by score), then members who only commented.
  type Row = { kind: "rating"; rating: Rating } | { kind: "comment"; comment: BookComment };
  const rows: Row[] = [
    ...ratings
      .slice()
      .sort((a, b) => (currentScore(b) ?? -1) - (currentScore(a) ?? -1))
      .map((rating): Row => ({ kind: "rating", rating })),
    ...comments
      .filter((c) => !ratings.some((r) => r.member_id === c.member_id))
      .map((comment): Row => ({ kind: "comment", comment })),
  ];

  if (rows.length === 0) {
    return (
      <p className="font-sans text-sm text-warm-brown/70">
        No one has rated this yet. Be the first.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {avg !== null && (
        <div className="flex items-center gap-5">
          <ScoreBadge score={avg} size="xl" />
          <div>
            <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-brown">
              Club score
            </p>
            <p className="font-sans text-sm text-charcoal/70 mt-1">
              {scores.length} rating{scores.length === 1 ? "" : "s"} revealed
              {ratings.length > scores.length && (
                <span className="text-warm-brown/60"> · {ratings.length - scores.length} hidden</span>
              )}
            </p>
          </div>
        </div>
      )}

      {visible.length > 1 && (
        <div className="pt-1">
          <div className="relative h-8">
            <div className="absolute top-1/2 left-0 right-0 h-1 rounded-full bg-charcoal/[0.06]" />
            {visible.map((r) => {
              const s = currentScore(r) as number;
              return (
                <div
                  key={r.id}
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2"
                  style={{ left: `${(s / 10) * 100}%` }}
                  title={`${r.member?.name ?? "Member"} · ${s.toFixed(1)}`}
                >
                  <Avatar name={r.member?.name ?? "?"} size="sm" className="ring-2 ring-cream" />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between font-sans text-[10px] text-warm-brown/50 mt-1">
            <span>0</span>
            <span>5</span>
            <span>10</span>
          </div>
        </div>
      )}

      <ul className="divide-y divide-charcoal/[0.06] -mx-1">
        {rows.map((row) => {
          const rating = row.kind === "rating" ? row.rating : null;
          const comment = row.kind === "rating"
            ? commentByMember.get(row.rating.member_id)
            : row.comment;
          const memberId = row.kind === "rating" ? row.rating.member_id : row.comment.member_id;
          const member = rating?.member ?? comment?.member;
          const name = member?.name ?? "Member";
          const isOwn = memberId === currentMemberId;
          const canSee = !rating || rating.is_visible || isOwn;
          const score = rating ? currentScore(rating) : null;
          const revised = rating?.post_rating !== null && rating?.post_rating !== undefined;
          const hasDetail = Boolean(comment) || (revised && canSee);
          const isOpen = open === memberId;

          return (
            <li key={memberId}>
              <button
                onClick={() => hasDetail && setOpen(isOpen ? null : memberId)}
                className={cn(
                  "w-full flex items-center gap-3 px-1 py-3 text-left rounded-lg transition-colors",
                  hasDetail && "hover:bg-charcoal/[0.03]"
                )}
                aria-expanded={isOpen}
              >
                <Avatar name={name} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="font-sans text-sm text-charcoal font-medium truncate">
                    {name}
                    {isOwn && <span className="text-warm-brown/60 font-normal"> · you</span>}
                  </p>
                  {comment && !isOpen && (
                    <p className="font-sans text-xs text-warm-brown/80 truncate mt-0.5">
                      &ldquo;{comment.content}&rdquo;
                    </p>
                  )}
                  {revised && canSee && !isOpen && (
                    <p className="font-sans text-[11px] text-warm-brown/60 mt-0.5">
                      Revised after the club
                    </p>
                  )}
                </div>
                {score !== null && canSee ? (
                  <ScoreBadge score={score} size="md" />
                ) : rating ? (
                  <span className="font-sans text-xs text-warm-brown/50 italic">Hidden</span>
                ) : null}
                {hasDetail && (
                  <svg
                    className={cn(
                      "w-4 h-4 text-warm-brown/50 flex-shrink-0 transition-transform",
                      isOpen && "rotate-180"
                    )}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                )}
              </button>

              {isOpen && (
                <div className="expand-in pl-[52px] pr-2 pb-4 space-y-3">
                  {comment && (
                    <p className="font-serif text-[15px] text-charcoal leading-relaxed">
                      &ldquo;{comment.content}&rdquo;
                    </p>
                  )}
                  {revised && canSee && rating && (
                    <div className="rounded-xl bg-charcoal/[0.04] px-4 py-3">
                      <p className="font-sans text-xs text-warm-brown">
                        Went in at{" "}
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: scoreTone(rating.pre_rating ?? 0).bg }}
                        >
                          {rating.pre_rating?.toFixed(1)}
                        </span>
                        , left at{" "}
                        <span
                          className="font-semibold tabular-nums"
                          style={{ color: scoreTone(rating.post_rating ?? 0).bg }}
                        >
                          {rating.post_rating?.toFixed(1)}
                        </span>
                      </p>
                      {rating.rating_change_reason && (
                        <p className="font-sans text-sm text-charcoal/80 mt-1.5 italic">
                          &ldquo;{rating.rating_change_reason}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
