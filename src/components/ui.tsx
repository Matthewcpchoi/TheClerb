"use client";

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { scoreColor } from "@/lib/design";

/* ---------------------------------------------------------------- Kicker */

/** Section label. Sentence case, never shouted. */
export function Kicker({
  children,
  tone = "muted",
  className,
}: {
  children: ReactNode;
  tone?: "muted" | "green";
  className?: string;
}) {
  return (
    <span className={cn("kicker", tone === "green" ? "text-green" : "text-muted", className)}>
      {children}
    </span>
  );
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("rule", className)} />;
}

export function Num({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span className={cn("num", className)} style={style}>
      {children}
    </span>
  );
}

/* ----------------------------------------------------------------- Scores */

/** A score in its own colour — red under 5, amber to 7, green above. */
export function Score({
  value,
  size = 17,
  className,
  blurred = false,
}: {
  value: number | null;
  size?: number;
  className?: string;
  blurred?: boolean;
}) {
  return (
    <span
      className={cn("num font-semibold", blurred ? "score-blur" : "score-reveal", className)}
      style={{ color: scoreColor(value), fontSize: size, lineHeight: 1 }}
    >
      {value === null ? "—" : value.toFixed(1)}
    </span>
  );
}

/* --------------------------------------------------------------- Buttons */

export function PillButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "rounded-full border border-green bg-transparent px-3 py-[5px]",
        "text-[11px] font-medium text-ink transition-colors active:bg-green/10 disabled:opacity-50",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function OutlineButton({
  className,
  selected = false,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }) {
  return (
    <button
      className={cn(
        "rounded-lg border px-4 py-[9px] text-[13px] transition-colors",
        // Selected fills in, so a chosen option is unmistakable.
        selected
          ? "border-green bg-green font-medium text-ground"
          : "border-tan bg-transparent text-muted active:bg-tan/40",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function SolidButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
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

/** Small × for removing a row. Everything a member adds can be taken back. */
export function DeleteButton({
  onDelete,
  label,
  className,
}: {
  onDelete: () => void;
  label: string;
  className?: string;
}) {
  return (
    <button
      onClick={onDelete}
      aria-label={label}
      className={cn(
        "flex h-6 w-6 flex-none items-center justify-center rounded-full",
        "text-muted/50 transition-colors active:bg-tan/50 active:text-ink",
        className
      )}
    >
      <X size={12} weight="bold" />
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
    <h1 className="text-[24px] font-medium leading-none tracking-[-0.02em] text-ink">{children}</h1>
  );
}

/** Bottom sheet. Used for pickers and the full shelf. */
export function Sheet({
  title,
  onClose,
  children,
  full = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  full?: boolean;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn(
          "pop-in flex w-full max-w-[448px] flex-col overflow-hidden rounded-t-[26px] bg-ground",
          full ? "h-[90vh]" : "max-h-[85vh]"
        )}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <h2 className="text-[20px] font-medium tracking-[-0.02em] text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-muted active:bg-tan/50"
          >
            <X size={18} />
          </button>
        </div>
        <div className="scrollbar-hide flex-1 overflow-y-auto overscroll-contain px-5 pb-8">
          {children}
        </div>
      </div>
    </div>
  );
}
