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

/* ------------------------------------------------- Colour from the cover */

const LEATHER_HEXES = new Set(LEATHERS.map((l) => l.hex));

/** A stored spine colour that isn't one of our fallbacks came from the art. */
export function isDerived(spine: string | null | undefined): boolean {
  return Boolean(spine && !LEATHER_HEXES.has(spine));
}

function toHex(r: number, g: number, b: number): string {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Foil on a dark binding, ink on a pale one. */
export function textOn(hex: string): string {
  return luminance(hex) > 0.62 ? "#2b2118" : "#e9d5a6";
}

/**
 * Pull a binding colour out of the actual cover art.
 *
 * This only works because covers are served through our own /api/cover route:
 * a same-origin image leaves the canvas untainted, where reading pixels
 * straight from a provider's CDN throws.
 */
export function extractSpineColor(book: {
  cover_url?: string | null;
  thumbnail_url?: string | null;
  isbn?: string | null;
  google_books_id?: string | null;
  title?: string | null;
  author?: string | null;
}): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(null);

    const params = new URLSearchParams();
    if (book.google_books_id) params.set("gid", book.google_books_id);
    if (book.isbn) params.set("isbn", book.isbn);
    if (book.title) params.set("title", book.title);
    if (book.author) params.set("author", book.author);
    if (!params.toString()) return resolve(null);

    const img = new Image();
    const timer = setTimeout(() => resolve(null), 8000);

    img.onerror = () => {
      clearTimeout(timer);
      resolve(null);
    };

    img.onload = () => {
      clearTimeout(timer);
      try {
        const W = 28;
        const H = 42;
        const canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, W, H);
        const { data } = ctx.getImageData(0, 0, W, H);

        // Bucket into coarse bins, then favour the bin that is both common
        // and colourful — an average would just return mud.
        const bins = new Map<string, { r: number; g: number; b: number; n: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (data[i + 3] < 200) continue;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          if (max > 242 && min > 232) continue; // paper white
          if (max < 18) continue; // pure black
          const key = `${r >> 5}-${g >> 5}-${b >> 5}`;
          const bin = bins.get(key) || { r: 0, g: 0, b: 0, n: 0 };
          bin.r += r;
          bin.g += g;
          bin.b += b;
          bin.n += 1;
          bins.set(key, bin);
        }
        if (bins.size === 0) return resolve(null);

        let best: { r: number; g: number; b: number } | null = null;
        let bestScore = -1;
        bins.forEach((bin) => {
          const r = bin.r / bin.n;
          const g = bin.g / bin.n;
          const b = bin.b / bin.n;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          const score = bin.n * (0.35 + sat);
          if (score > bestScore) {
            bestScore = score;
            best = { r, g, b };
          }
        });
        if (!best) return resolve(null);

        // Deepen it to binding weight so stamped titles stay legible.
        const { r, g, b } = best as { r: number; g: number; b: number };
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const k = lum > 0.55 ? 0.62 : lum > 0.35 ? 0.82 : 1;
        resolve(toHex(r * k, g * k, b * k));
      } catch {
        resolve(null);
      }
    };

    img.src = `/api/cover?${params.toString()}`;
  });
}
