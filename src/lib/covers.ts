/**
 * Cover URL resolution.
 *
 * Google Books cover URLs need real surgery, not string replacement:
 *  - `edge=curl` composites a fake folded-page graphic onto the right edge.
 *    It is never what we want on a bookshelf, and because Google returns
 *    HTTP 200 for it, an onError cascade can never route around it.
 *  - `zoom` controls render size; the thumbnail default (zoom=1) is ~128px,
 *    which visibly blurs at the sizes this app displays covers.
 *
 * Everything here builds an ordered candidate list; components render
 * candidates[0] and advance on failure.
 */

// Ordering is empirical — zoom=2 is the best size/availability tradeoff for
// most volumes, with 1 as the reliable fallback. See docs/AUDIT_AND_FIXES.md.
const GOOGLE_ZOOM_ORDER = [2, 1, 3, 0];

function isGoogleBooks(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith("books.google.com");
  } catch {
    return false;
  }
}

function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().replace(/&amp;/g, "&");
  if (!trimmed) return null;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  if (trimmed.startsWith("http://")) return `https://${trimmed.slice(7)}`;
  return trimmed;
}

/** Rebuild a Google Books content URL at a given zoom, without the page curl. */
export function googleCoverUrl(raw: string, zoom: number): string | null {
  try {
    const u = new URL(raw);
    u.protocol = "https:";
    u.searchParams.delete("edge");
    u.searchParams.set("img", "1");
    u.searchParams.set("printsec", "frontcover");
    u.searchParams.set("zoom", String(zoom));
    return u.toString();
  } catch {
    return null;
  }
}

export function googleCoverUrlFromId(volumeId: string, zoom: number): string {
  return (
    "https://books.google.com/books/content" +
    `?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=${zoom}`
  );
}

/**
 * `default=false` makes Open Library 404 on a missing cover. Without it the
 * response is HTTP 200 with a 1x1 transparent GIF, which renders as an
 * invisible cover and never triggers onError.
 */
export function openLibraryCoverUrl(isbn: string, size: "S" | "M" | "L"): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}

export interface CoverIdentifiers {
  cover_url?: string | null;
  thumbnail_url?: string | null;
  isbn?: string | null;
  google_books_id?: string | null;
  title?: string | null;
  author?: string | null;
}

/**
 * Our own proxy endpoint. It resolves across Open Library, Google Books and
 * Apple Books server-side and rejects provider placeholders before they reach
 * the browser, so it is tried before any direct provider URL.
 */
export function proxyCoverUrl(book: CoverIdentifiers): string | null {
  const params = new URLSearchParams();
  if (book.google_books_id) params.set("gid", book.google_books_id);
  if (book.isbn) params.set("isbn", book.isbn);
  if (book.title) params.set("title", book.title);
  if (book.author) params.set("author", book.author);

  // Nothing to search on.
  const qs = params.toString();
  return qs ? `/api/cover?${qs}` : null;
}

/** Ordered best -> worst. Render the first; advance on failure. */
export function getBookCoverCandidates(book: CoverIdentifiers): string[] {
  const out: string[] = [];
  const push = (u: string | null | undefined) => {
    if (u && !out.includes(u)) out.push(u);
  };

  const stored = [book.cover_url, book.thumbnail_url]
    .map(normalizeUrl)
    .filter((u): u is string => u !== null);

  for (const url of stored) {
    if (isGoogleBooks(url)) {
      for (const zoom of GOOGLE_ZOOM_ORDER) push(googleCoverUrl(url, zoom));
    } else {
      push(url); // already a usable direct URL
    }
  }

  // Reconstruct from the volume id when the stored URLs are unusable.
  if (book.google_books_id) {
    for (const zoom of GOOGLE_ZOOM_ORDER) {
      push(googleCoverUrlFromId(book.google_books_id, zoom));
    }
  }

  // Second source. Only reachable for books that have an ISBN stored.
  if (book.isbn) {
    push(openLibraryCoverUrl(book.isbn, "L"));
    push(openLibraryCoverUrl(book.isbn, "M"));
  }

  // Server-side multi-provider resolution LAST, as a rescue for books none of
  // the direct URLs can satisfy. It is deliberately not first: loading these
  // images straight from the browser is the path that has always worked, and
  // a server-side fetch from a datacenter IP is likelier to be refused by the
  // provider than one from the reader's own device.
  push(proxyCoverUrl(book));

  return out;
}
