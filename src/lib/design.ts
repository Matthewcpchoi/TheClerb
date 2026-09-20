/**
 * Visual derivations for the shelf.
 *
 * Spines need a colour, a width and a height. All three come from a stable
 * hash of the title, so a book looks the same on every device and every visit.
 *
 * The palette here deliberately goes wider than the app's five colours: a
 * shelf of five greens reads as a chart, not a bookcase. These are bound-book
 * leathers — oxblood, cocoa, olive, navy, ochre — kept in the same saturation
 * and lightness band as the brand green so they still sit together.
 */

export interface Leather {
  hex: string;
  /** Foil-stamped titles on dark leather; ink on the light tans. */
  text: string;
  light: boolean;
}

const LEATHERS: Leather[] = [
  { hex: "#0e5f49", text: "#e6cf9c", light: false }, // forest
  { hex: "#6b3f2a", text: "#e8d3a4", light: false }, // saddle brown
  { hex: "#7d2b2b", text: "#e9cf9e", light: false }, // oxblood
  { hex: "#2f4a6b", text: "#e3d4ab", light: false }, // navy
  { hex: "#5a4632", text: "#e7d5aa", light: false }, // cocoa
  { hex: "#4a5d2f", text: "#e8dca6", light: false }, // olive
  { hex: "#6b2745", text: "#e9cfa8", light: false }, // plum
  { hex: "#8a5a2b", text: "#f1e0b4", light: false }, // tan leather
  { hex: "#3f3a34", text: "#ddcfa6", light: false }, // charcoal calf
  { hex: "#00785d", text: "#e6cf9c", light: false }, // deep teal-green
  { hex: "#c9a36a", text: "#3a2a18", light: true }, // buckram tan
  { hex: "#9c6b2f", text: "#f3e6c2", light: false }, // ochre
];

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

export function leather(seed: string): Leather {
  return LEATHERS[hash(seed) % LEATHERS.length];
}

/** Kept for cover-frame and tile backgrounds. */
export function spineColor(seed: string): string {
  return leather(seed).hex;
}

export function spineTextColor(seed: string): string {
  return leather(seed).text;
}

export function isDarkSpine(seed: string): boolean {
  return !leather(seed).light;
}

/** 22–44px, so the row reads as real books rather than even slats. */
export function spineWidth(seed: string): number {
  return 22 + (hash(seed + "w") % 23);
}

/** 118–152px. */
export function spineHeight(seed: string): number {
  return 118 + (hash(seed + "h") % 35);
}

/* ------------------------------------------------------------------ Scores */

/**
 * Red / amber / green, held in the same saturation and lightness band as the
 * brand green so a score reads at a glance without leaving the palette.
 */
export function scoreColor(score: number | null | undefined): string {
  if (score === null || score === undefined) return "#3d6a58";
  if (score < 5) return "#a33a33";
  if (score < 7) return "#b0801d";
  return "#009774";
}

export function scoreWord(score: number | null | undefined): string {
  if (score === null || score === undefined) return "No score";
  if (score < 5) return "Didn't land";
  if (score < 7) return "Fine";
  return "Loved it";
}

/** "Jun 2024" — how the shelf dates a read. */
export function shortMonthYear(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}
