/**
 * Server-side cover resolution across multiple providers.
 *
 * This runs on the server, not in the browser, which is what makes it more
 * reliable than hotlinking Google Books directly:
 *  - no CORS, referrer or hotlink-blocking constraints
 *  - responses can be inspected before being handed to the browser, so
 *    provider "no cover available" placeholders can be rejected
 *  - a title/author search can find covers for books with no ISBN
 *
 * Providers are ordered by observed reliability for book cover art.
 */

const FETCH_TIMEOUT_MS = 2500;

export interface CoverQuery {
  googleBooksId?: string | null;
  isbn?: string | null;
  title?: string | null;
  author?: string | null;
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function googleContentUrl(volumeId: string, zoom: number): string {
  return (
    "https://books.google.com/books/content" +
    `?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=${zoom}`
  );
}

/** Open Library covers. `default=false` makes a miss 404 instead of a blank GIF. */
function openLibraryByIsbn(isbn: string, size: "L" | "M"): string {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;
}

function openLibraryById(coverId: number, size: "L" | "M"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

/** Open Library search — finds a cover from title/author when no ISBN exists. */
async function openLibrarySearch(query: CoverQuery): Promise<string[]> {
  if (!query.title) return [];

  const params = new URLSearchParams({
    title: query.title,
    limit: "3",
    fields: "cover_i,isbn",
  });
  if (query.author) params.set("author", query.author);

  const data = (await fetchJson(
    `https://openlibrary.org/search.json?${params}`
  )) as { docs?: { cover_i?: number; isbn?: string[] }[] } | null;

  const out: string[] = [];
  for (const doc of data?.docs ?? []) {
    if (doc.cover_i) out.push(openLibraryById(doc.cover_i, "L"));
  }
  return out;
}

/** Google Books search — a second chance when the stored volume id is stale. */
async function googleBooksSearch(query: CoverQuery): Promise<string[]> {
  if (!query.title) return [];

  const terms = [`intitle:${query.title}`];
  if (query.author) terms.push(`inauthor:${query.author}`);

  const key =
    process.env.NEXT_PUBLIC_GOOGLE_BOOKS_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY ||
    "";
  const params = new URLSearchParams({
    q: terms.join(" "),
    maxResults: "3",
    printType: "books",
  });
  if (key) params.set("key", key);

  const data = (await fetchJson(
    `https://www.googleapis.com/books/v1/volumes?${params}`
  )) as { items?: { id?: string }[] } | null;

  return (data?.items ?? [])
    .map((item) => item.id)
    .filter((id): id is string => Boolean(id))
    .map((id) => googleContentUrl(id, 2));
}

/**
 * Apple Books search. Artwork is served from Apple's CDN with permissive
 * caching and no hotlink protection, and the 100x100 URL can be rewritten to
 * any size — a reliable last resort for mainstream titles.
 */
async function appleBooksSearch(query: CoverQuery): Promise<string[]> {
  if (!query.title) return [];

  const term = [query.title, query.author].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    term,
    entity: "ebook",
    limit: "3",
  });

  const data = (await fetchJson(
    `https://itunes.apple.com/search?${params}`
  )) as { results?: { artworkUrl100?: string }[] } | null;

  return (data?.results ?? [])
    .map((r) => r.artworkUrl100)
    .filter((u): u is string => Boolean(u))
    .map((u) => u.replace(/\/\d+x\d+bb\.(jpg|png)$/, "/600x600bb.jpg"));
}

/**
 * Ordered cover URL candidates, best source first. Direct identifier lookups
 * come before searches, since a search can match the wrong edition.
 */
export function directCoverCandidates(query: CoverQuery): string[] {
  const candidates: string[] = [];
  const push = (u: string) => {
    if (u && !candidates.includes(u)) candidates.push(u);
  };

  if (query.isbn) {
    push(openLibraryByIsbn(query.isbn, "L"));
    push(openLibraryByIsbn(query.isbn, "M"));
  }
  if (query.googleBooksId) {
    push(googleContentUrl(query.googleBooksId, 2));
    push(googleContentUrl(query.googleBooksId, 1));
  }

  return candidates;
}

/**
 * Search-derived candidates. Only worth paying for when the direct lookups
 * above have already failed — each one costs an extra API round trip.
 */
export async function searchCoverCandidates(
  query: CoverQuery
): Promise<string[]> {
  const candidates: string[] = [];
  const push = (u: string) => {
    if (u && !candidates.includes(u)) candidates.push(u);
  };

  const [openLibrary, google, apple] = await Promise.all([
    openLibrarySearch(query),
    googleBooksSearch(query),
    appleBooksSearch(query),
  ]);

  openLibrary.forEach(push);
  apple.forEach(push);
  google.forEach(push);

  return candidates;
}
