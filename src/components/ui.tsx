"use client";

import { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------- Kicker */

export function Kicker({
  children,
  tone = "muted",
  wide = false,
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "green";
  wide?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "kicker",
        wide && "kicker-wide",
        tone === "green" ? "text-green" : "text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Rule */

/** 1px divider that fades to transparent at both ends. */
export function Rule({ className }: { className?: string }) {
  return <div className={cn("rule", className)} />;
}

/* ---------------------------------------------------------------- Number */

/** All numerals are monospace. */
export function Num({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("num", className)}>{children}</span>;
}

/* --------------------------------------------------------------- Buttons */

/** 99px outlined pill — "Reveal scores", "Hide". */
export function PillButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-full border border-green bg-transparent px-3 py-[5px]",
        "text-[11px] font-medium text-ink transition-colors",
        "active:bg-green/10 disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** 8px outlined control — RSVP, Add. */
export function OutlineButton({
  className,
  selected = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={cn(
        "rounded-lg border bg-transparent px-4 py-[9px] text-[13px] transition-colors",
        selected
          ? "border-green font-medium text-ink"
          : "border-tan text-muted active:bg-tan/30",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Solid action — used only where the design has no equivalent (add a book). */
export function SolidButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-lg bg-ink px-4 py-[9px] text-[13px] font-medium text-ground",
        "transition-opacity active:opacity-80 disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- Avatar */

export function Initials({
  name,
  size = 56,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
  return (
    <div
      className={cn(
        "flex flex-none items-center justify-center rounded-full border border-green text-ink",
        className
      )}
      style={{ width: size, height: size, fontSize: size * 0.34, fontWeight: 500 }}
    >
      {initials}
    </div>
  );
}

/* ------------------------------------------------------------ Screen bits */

export function ScreenTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-[24px] font-medium leading-none tracking-[-0.02em] text-ink">
      {children}
    </h1>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-[13px] leading-relaxed text-muted">{children}</p>;
}
