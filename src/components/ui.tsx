"use client";

import Link from "next/link";
import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn, getAvatarColor, getInitials } from "@/lib/utils";

/* ------------------------------------------------------------------ Score */

/**
 * The score colour scale used everywhere a rating appears.
 *   < 5     bad     muted red
 *   5–6.9   okay    amber
 *   7–9.9   good    sage green
 *   10      perfect gold, with its own glow
 */
export function scoreTone(score: number): {
  bg: string;
  fg: string;
  ring: string;
  label: string;
  perfect: boolean;
} {
  if (score >= 9.95) {
    return { bg: "#c49a3b", fg: "#fbf5ea", ring: "#e2c46f", label: "Perfect", perfect: true };
  }
  if (score >= 7) {
    return { bg: "#5f8a5b", fg: "#fbf5ea", ring: "#8fb08b", label: "Good", perfect: false };
  }
  if (score >= 5) {
    return { bg: "#c9862b", fg: "#fbf5ea", ring: "#e0aa5c", label: "Okay", perfect: false };
  }
  return { bg: "#b5433e", fg: "#fbf5ea", ring: "#d3746f", label: "Bad", perfect: false };
}

type BadgeSize = "sm" | "md" | "lg" | "xl";

const BADGE_SIZE: Record<BadgeSize, { box: string; text: string }> = {
  sm: { box: "w-8 h-8", text: "text-[11px]" },
  md: { box: "w-10 h-10", text: "text-[13px]" },
  lg: { box: "w-14 h-14", text: "text-lg" },
  xl: { box: "w-20 h-20", text: "text-2xl" },
};

/**
 * A round score badge with the number optically centred: a sans face with
 * tabular numerals, line-height 1, and a half-pixel nudge to offset the
 * baseline sitting low inside a circle.
 */
export function ScoreBadge({
  score,
  size = "md",
  className,
  muted = false,
}: {
  score: number;
  size?: BadgeSize;
  className?: string;
  muted?: boolean;
}) {
  const tone = scoreTone(score);
  const { box, text } = BADGE_SIZE[size];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center flex-shrink-0 select-none",
        "ring-2 ring-cream shadow-md",
        box,
        tone.perfect && !muted && "score-perfect",
        className
      )}
      style={{
        backgroundColor: tone.bg,
        color: tone.fg,
        ...(muted ? { filter: "saturate(0.6) brightness(0.9)" } : {}),
      }}
      title={`${score.toFixed(1)} · ${tone.label}`}
      aria-label={`Score ${score.toFixed(1)}`}
    >
      <span
        className={cn("font-sans font-semibold tabular-nums leading-none", text)}
        style={{ transform: "translateY(0.5px)" }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}

/* ----------------------------------------------------------------- Avatar */

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const dims = {
    xs: "w-5 h-5 text-[8px]",
    sm: "w-7 h-7 text-[10px]",
    md: "w-9 h-9 text-xs",
    lg: "w-12 h-12 text-sm",
  }[size];
  return (
    <div
      className={cn(
        "rounded-full flex items-center justify-center text-cream font-sans font-semibold flex-shrink-0",
        dims,
        className
      )}
      style={{ backgroundColor: getAvatarColor(name) }}
      title={name}
    >
      {getInitials(name)}
    </div>
  );
}

/* ----------------------------------------------------------------- Button */

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-mahogany text-cream hover:bg-espresso shadow-sm",
  secondary:
    "bg-white/70 text-charcoal border border-charcoal/10 hover:border-charcoal/25 hover:bg-white",
  ghost: "text-warm-brown hover:bg-charcoal/5",
  danger: "text-red-700 border border-red-200 hover:bg-red-50",
  gold: "bg-gold text-cream hover:bg-gold-light shadow-sm",
};

const SIZE: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-4 text-sm rounded-xl",
  lg: "h-12 px-6 text-base rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-sans font-medium transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]",
        VARIANT[variant],
        SIZE[size],
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-sans font-medium transition-all active:scale-[0.98]",
        VARIANT[variant],
        SIZE[size],
        className
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------- Card */

export function Card({
  className,
  children,
  padded = true,
}: {
  className?: string;
  children: ReactNode;
  padded?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-white/60 backdrop-blur-[2px] border border-charcoal/[0.08] rounded-2xl shadow-[0_1px_2px_rgba(43,38,34,0.04),0_8px_24px_-12px_rgba(43,38,34,0.18)]",
        padded && "p-5 sm:p-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ----------------------------------------------------------------- Layout */

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-gold mb-2">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-3xl sm:text-4xl text-charcoal tracking-tight leading-none">
          {title}
        </h1>
        {subtitle && (
          <p className="font-sans text-sm text-warm-brown mt-2">{subtitle}</p>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
  className,
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-3 mb-4", className)}>
      <h2 className="font-sans text-[11px] font-semibold uppercase tracking-[0.18em] text-warm-brown">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-6">
      <p className="font-serif text-lg text-charcoal">{title}</p>
      {body && <p className="font-sans text-sm text-warm-brown mt-1.5 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function StatusPill({ status }: { status: "reading" | "completed" | "upcoming" }) {
  const map = {
    reading: { label: "Reading now", cls: "bg-sage/15 text-sage" },
    completed: { label: "Finished", cls: "bg-gold/15 text-[#8a6a22]" },
    upcoming: { label: "Up next", cls: "bg-charcoal/[0.06] text-warm-brown" },
  }[status];
  return (
    <span
      className={cn(
        "inline-flex items-center h-6 px-2.5 rounded-full font-sans text-[11px] font-semibold uppercase tracking-wider",
        map.cls
      )}
    >
      {map.label}
    </span>
  );
}

export const inputClass =
  "w-full h-11 px-4 rounded-xl border border-charcoal/10 bg-white font-sans text-[15px] text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 transition-colors";

export const textareaClass =
  "w-full px-4 py-3 rounded-xl border border-charcoal/10 bg-white font-sans text-[15px] text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-2 focus:ring-gold/25 transition-colors resize-none leading-relaxed";
