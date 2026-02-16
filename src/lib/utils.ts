export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function getAvatarColor(name: string): string {
  const colors = [
    "#3C1518",
    "#69381A",
    "#7A8B69",
    "#C49A3B",
    "#8B5E3C",
    "#556B2F",
    "#704214",
    "#800020",
    "#2E1A47",
    "#1B4332",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString + "T00:00:00");
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(timeString: string): string {
  const [hours, minutes] = timeString.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function parsePageValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

export function getExactPageCount(book: { page_count?: number | string | null; total_pages?: number | string | null }): number | null {
  return parsePageValue(book.page_count) ?? parsePageValue(book.total_pages);
}

function normalizeCoverUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim().replace(/&amp;/g, "&");
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return trimmed;
}

function getGoogleCoverVariants(url: string): string[] {
  if (!url.includes("books.google")) return [url];

  const variants = new Set<string>([url]);

  for (const zoom of [3, 2, 1, 0]) {
    variants.add(url.replace(/zoom=\d/, `zoom=${zoom}`));
  }

  // Google sometimes fails with edge=curl in some contexts.
  variants.add(url.replace(/([?&])edge=curl&?/, "$1").replace(/[?&]$/, ""));

  // Also try variants with both zoom adjustments and edge removed.
  for (const value of Array.from(variants)) {
    variants.add(value.replace(/([?&])edge=curl&?/, "$1").replace(/[?&]$/, ""));
  }

  return Array.from(variants);
}

/**
 * Returns an ordered list of cover URLs to try, from best to worst quality.
 * Components should render the first URL and cascade via onError.
 *
 * For Google Books URLs the function generates additional variants so
 * the browser can fall back if one URL fails.
 */
export function getBookCoverCandidates(book: {
  thumbnail_url?: string | null;
  cover_url?: string | null;
}): string[] {
  const cover = normalizeCoverUrl(book.cover_url);
  const thumbnail = normalizeCoverUrl(book.thumbnail_url);

  const candidates = new Set<string>();

  for (const url of [cover, thumbnail]) {
    if (!url) continue;
    for (const variant of getGoogleCoverVariants(url)) {
      candidates.add(variant);
    }
  }

  return Array.from(candidates);
}

