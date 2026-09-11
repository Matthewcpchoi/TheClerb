/**
 * Server-side cover resolution.
 *
 * The governing idea is the distinction between a *work* and an *edition*.
 * "The Women" is one work with dozens of editions — US hardcover, UK
 * paperback, large print, translations, audiobook — and every edition carries
 * its own ISBN and its own cover art.
 *
 * Asking a provider for the cover of a specific ISBN returns that edition's
 * art, which is frequently not the cover anyone recognises. Goodreads and
 * similar apps resolve to the work and show its primary edition instead, so
 * that is what this module does:
 *
 *   1. resolve the ISBN to a work, and take the work's own cover
 *   2. search by title/author, verifying the result really is this book,
 *      and take the work-level cover from the match
 *   3. only then fall back to edition-specific and Google volume art
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

// ---------------------------------------------------------------- matching

/** Strip case, punctuation, subtitles and leading articles for comparison. */
function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .split(/[:(]/)[0] // drop subtitle and parenthetical edition notes
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/^(the|a|an)\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeAuthor(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Whether a provider result is actually the book we asked for. Taking the
 * first search hit unverified is how a search lands on a study guide, a
 * boxed set, or an unrelated book with a similar title.
 */
function isMatch(
  query: CoverQuery,
  candidateTitle?: string,
  candidateAuthors?: string[]
): boolean {
  if (!query.title || !candidateTitle) return false;

  const wanted = normalizeTitle(query.title);
  const got = normalizeTitle(candidateTitle);
  if (!wanted || !got) return false;
  if (wanted !== got && !got.startsWith(wanted) && !wanted.startsWith(got)) {
    return false;
  }

  // Title agrees. If we know the author, at least one surname should too.
  if (!query.author || !candidateAuthors?.length) return true;

  const wantedParts = normalizeAuthor(query.author).split(" ").filter(Boolean);
  const wantedSurname = wantedParts[wantedParts.length - 1];
  if (!wantedSurname) return true;

  return candidateAuthors.some((a) =>
    normalizeAuthor(a).split(" ").includes(wantedSurname)
  );
}

// ---------------------------------------------------------------- providers

function googleContentUrl(volumeId: string, zoom: number): string {
  return (
    "https://books.google.com/books/content" +
    `?id=${encodeURIComponent(volumeId)}&printsec=frontcover&img=1&zoom=${zoom}`
  );
}

/** `default=false` makes a miss a real 404 rather than a blank GIF. */
function openLibraryById(coverId: number, size: "L" | "M" = "L"): string {
  return `https://covers.openlibrary.org/b/id/${coverId}-${size}.jpg?default=false`;
}

function openLibraryByOlid(olid: string, size: "L" | "M" = "L"): string {
  return `https://covers.openlibrary.org/b/olid/${encodeURIComponent(olid)}-${size}.jpg?default=false`;
}

function openLibraryByIsbn(isbn: string, size: "L" | "M"): string {
  return `https://covers.openlibrary.org/b/isbn/${encodeURIComponent(isbn)}-${size}.jpg?default=false`;
}

/**
 * ISBN -> edition -> work -> the work's own cover.
 *
 * This is the step that fixes "right book, wrong art": the ISBN identifies one
 * edition, but the work carries the primary cover that readers recognise.
 */
async function openLibraryWorkCover(isbn: string): Promise<string[]> {
  const edition = (await fetchJson(
    `https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`
  )) as { works?: { key?: string }[] } | null;

  const workKey = edition?.works?.[0]?.key;
  if (!workKey) return [];

  const work = (await fetchJson(
    `https://openlibrary.org${workKey}.json`
  )) as { covers?: number[] } | null;

  return (work?.covers ?? [])
    .filter((id) => id > 0)
    .slice(0, 2)
    .map((id) => openLibraryById(id));
}

/**
 * Open Library search, verified. `cover_i` is the work's primary cover and
 * `cover_edition_key` its representative edition — both work-level answers,
 * unlike a raw ISBN lookup.
 */
async function openLibrarySearch(query: CoverQuery): Promise<string[]> {
  if (!query.title) return [];

  const params = new URLSearchParams({
    q: [query.title, query.author].filter(Boolean).join(" "),
    limit: "8",
    fields: "title,author_name,cover_i,cover_edition_key",
  });

  const data = (await fetchJson(
    `https://openlibrary.org/search.json?${params}`
  )) as {
    docs?: {
      title?: string;
      author_name?: string[];
      cover_i?: number;
      cover_edition_key?: string;
    }[];
  } | null;

  const out: string[] = [];
  for (const doc of data?.docs ?? []) {
    if (!isMatch(query, doc.title, doc.author_name)) continue;
    if (doc.cover_edition_key) out.push(openLibraryByOlid(doc.cover_edition_key));
    if (doc.cover_i) out.push(openLibraryById(doc.cover_i));
  }
  return out;
}

/**
 * Apple Books, verified. Apple lists the current commercial edition, so its
 * artwork is usually the cover in print today — a good work-level proxy.
 */
async function appleBooksSearch(query: CoverQuery): Promise<string[]> {
  if (!query.title) return [];

  const term = [query.title, query.author].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    term,
    entity: "ebook",
    country: "US",
    limit: "10",
  });

  const data = (await fetchJson(
    `https://itunes.apple.com/search?${params}`
  )) as {
    results?: {
      trackName?: string;
      artistName?: string;
      artworkUrl100?: string;
    }[];
  } | null;

  const out: string[] = [];
  for (const r of data?.results ?? []) {
    if (!r.artworkUrl100) continue;
    if (!isMatch(query, r.trackName, r.artistName ? [r.artistName] : [])) {
      continue;
    }
    // Apple serves any size from the same path; the suffix form varies.
    out.push(r.artworkUrl100.replace(/\/\d+x\d+bb[^/]*$/, "/600x600bb.jpg"));
  }
  return out;
}

// ------------------------------------------------------------------ phases

/** Phase 1 — work-level art derived from the ISBN. */
export async function workCoverCandidates(query: CoverQuery): Promise<string[]> {
  if (!query.isbn) return [];
  return openLibraryWorkCover(query.isbn);
}

/** Phase 2 — verified title/author searches, still work-level. */
export async function searchCoverCandidates(
  query: CoverQuery
): Promise<string[]> {
  const [openLibrary, apple] = await Promise.all([
    openLibrarySearch(query),
    appleBooksSearch(query),
  ]);

  const out: string[] = [];
  for (const u of [...openLibrary, ...apple]) {
    if (!out.includes(u)) out.push(u);
  }
  return out;
}

/**
 * Phase 3 — edition-specific and Google volume art. Correct books, but often
 * not the recognisable cover, so they only run when everything above misses.
 */
export function lastResortCandidates(query: CoverQuery): string[] {
  const out: string[] = [];
  if (query.isbn) {
    out.push(openLibraryByIsbn(query.isbn, "L"));
    out.push(openLibraryByIsbn(query.isbn, "M"));
  }
  if (query.googleBooksId) {
    out.push(googleContentUrl(query.googleBooksId, 2));
    out.push(googleContentUrl(query.googleBooksId, 1));
  }
  return out;
}
