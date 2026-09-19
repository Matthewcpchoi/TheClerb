/**
 * Visual derivations for the shelf.
 *
 * Spines need a colour, a width and a height. The design draws them from the
 * palette with per-book variation so the row reads as real books rather than a
 * bar chart. All three are derived from a stable hash of the title, so a book
 * looks the same on every device and every visit.
 */

/** Cover colours in the design are palette values, not arbitrary. */
export const SPINE_COLORS = ["#0e5f49", "#009774", "#e6d2b6", "#2dbba1"] as const;

const TAN = "#e6d2b6";

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  return Math.abs(h);
}

export function spineColor(seed: string): string {
  return SPINE_COLORS[hash(seed) % SPINE_COLORS.length];
}

/** Tan spines need dark text; the three greens need light. */
export function spineTextColor(color: string): string {
  return color === TAN ? "#0e5f49" : "rgba(255,245,231,.85)";
}

export function isDarkSpine(color: string): boolean {
  return color !== TAN;
}

/** 20–40px, per the design's range. */
export function spineWidth(seed: string): number {
  return 20 + (hash(seed + "w") % 21);
}

/** 114–150px, per the design's range. */
export function spineHeight(seed: string): number {
  return 114 + (hash(seed + "h") % 37);
}

/** "Jun 2024" — how the shelf caption dates a read. */
export function shortMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
