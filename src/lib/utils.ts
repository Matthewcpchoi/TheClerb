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

/**
 * Returns an ordered list of cover URLs to try, from best to worst quality.
 * Components should render the first URL and cascade via onError.
 *
 * For Google Books URLs the function generates additional zoom variants so
 * the browser can fall back if one resolution 404s.
 */
export function getBookCoverCandidates(book: {
  thumbnail_url?: string | null;
  cover_url?: string | null;
}): string[] {
  const cover = normalizeCoverUrl(book.cover_url);
  const thumbnail = normalizeCoverUrl(book.thumbnail_url);

  const candidates: (string | null)[] = [cover];

  // If cover is a Google Books URL, also add zoom variants as fallbacks
  if (cover && cover.includes("books.google")) {
    const zoom1 = cover.replace(/zoom=\d/, "zoom=1");
    if (zoom1 !== cover) candidates.push(zoom1);
  }

  candidates.push(thumbnail);

  // If thumbnail is a Google Books URL, add a zoom=3 variant
  if (thumbnail && thumbnail.includes("books.google")) {
    const zoom3 = thumbnail.replace(/zoom=\d/, "zoom=3");
    if (zoom3 !== thumbnail && !candidates.includes(zoom3)) {
      candidates.push(zoom3);
    }
  }

  return candidates.filter(
    (url, index, arr): url is string => !!url && arr.indexOf(url) === index
  );
}
