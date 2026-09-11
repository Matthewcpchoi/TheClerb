# The Clerb — Audit & Remediation Plan

**Date:** 2026-09-10
**Branch:** `claude/build-book-club-app-MvNxn`
**Scope:** Full review of `src/`, schema docs, and build config.
**Build status:** `npm run build` exits 0 — every defect below is a *runtime* or *design* defect, not a compile error. That is why nothing here shows up in CI.

---

## Executive summary

The app is structurally sound. The problems cluster into five root causes:

| # | Root cause | Symptom you see |
|---|---|---|
| **R1** | **Cover URLs are frozen into the DB at add-time and rendered with Google's `edge=curl` artifact at an upscaled zoom.** | Covers look folded/warped on the right edge, blurry on the detail page, and inconsistent from book to book. |
| **R2** | **The fallback chain can only ever reach Google.** No ISBN is stored, so the Open Library fallback is unreachable for every book already on the shelf. | Some books show a blank or broken cover forever, with no way to repair them. |
| **R3** | **Schema drift** — code reads/writes `page_count`, `completed_at`, but the documented schema only has `total_pages`. | "Total Pages Read" silently missing; "Read <month year>" never appears. |
| **R4** | **Every Supabase error is discarded** (24 call sites destructure only `data`). | Failures render as empty screens with no diagnostic. |
| **R5** | **Six divergent copies of the same cover-cascade logic.** | Each surface fails differently; fixing one doesn't fix the others. |

**Fix R1 + R2 first.** They are ~90% of what you're describing, and they're a half-day of work.

---

# Part 1 — The cover image pipeline (primary issue)

## 1.1 The headline bug: every Google cover renders with the page-curl artifact

`getBookCoverUrl()` (`src/lib/google-books.ts:79-82`) stores the thumbnail URL as-is:

```ts
const url = links.thumbnail || links.smallThumbnail || null;
return url.replace("http://", "https://").replace("zoom=1", "zoom=3");
```

Google's `imageLinks.thumbnail` is always of the form:

```
http://books.google.com/books/content?id=XXX&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api
```

`edge=curl` tells Google to composite a **fake folded-page graphic** onto the right edge of the cover. It is never stripped before storage. Then in `getBookCoverCandidates()` → `getGoogleCoverVariants()` (`src/lib/utils.ts:74-92`), the candidate list is built in this order:

```
[ zoom3+curl, zoom2+curl, zoom1+curl, zoom0+curl,
  zoom3-nocurl, zoom2-nocurl, zoom1-nocurl, zoom0-nocurl ]
```

All four curl variants are tried **first**. And they return **HTTP 200** — so `onError` never fires and the cascade never advances. The curl-free variants at positions 5-8 are dead code that can never be reached.

**Every Google-sourced cover in the app is displayed with the page-curl artifact.** Combined with `object-cover` on a fixed 2:3 box, the curl gets cropped into an odd dark band.

This also explains the *inconsistency*: `extraLarge`/`large`/`medium` links (returned only by the volume-detail endpoint, for volumes Google has hi-res scans of) do **not** carry `edge=curl`. So books that happen to have hi-res links look clean, and books that fall back to `thumbnail` look folded. Same shelf, two different looks.

### 1.2 Upscaling blur

`zoom=1` yields roughly a 128px-wide image. The book detail page renders it at `w-48 h-72` (192×288 CSS px, 384×576 on a retina display) — a 3-4× upscale. The `.replace("zoom=1", "zoom=3")` is meant to counter this, but:

- it's a **literal string replace**, so it only fires when the URL contains exactly `zoom=1`;
- `zoom` behaviour is not uniform across volumes — for many, high zoom values clamp back to the same bitmap or return the *cropped/zoomed-in* interior of the cover rather than a larger render.

> ⚠️ **Verify empirically.** My sandbox has no outbound access to `books.google.com` (403) or `googleapis.com` (429), so I could not benchmark zoom levels against live volumes. Before locking in an ordering, run the probe script in §1.8 against ~20 of your real books and pick the order that wins.

### 1.3 The Open Library fallback is unreachable

`getOpenLibraryCoverByISBN()` is called in exactly one place: `BookSearch.tsx:82`, at insert time, and **only when Google returned no cover at all**.

`getBookCoverCandidates()` (the function every render path uses) reads only `cover_url` and `thumbnail_url`. There is no `isbn` column on `books` and no `isbn` field on the `Book` type — so at render time the app has no way to construct an Open Library URL.

**Consequence:** once a book is saved with a bad Google URL, it is permanently broken. There is no second source and no repair path.

### 1.4 Open Library returns a blank GIF, not a 404

```ts
return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg`;
```

When Open Library has no cover for an ISBN, this returns **HTTP 200 with a 1×1 transparent GIF**. `onError` will not fire; you get an invisible cover. The `?default=false` parameter makes it return 404 instead, which is what the cascade needs.

### 1.5 Google's "image not available" placeholder also returns 200

For volumes with no cover, `books.google.com/books/content` returns a small grey "image not available" bitmap with a 200 status. Again `onError` never fires. The only reliable detection is checking `naturalWidth` in `onLoad` — currently done nowhere.

### 1.6 Dead-end states with no placeholder

When the cascade exhausts (`imageIndex` past the end of the array), behaviour is inconsistent across the six call sites:

| File | Behaviour on exhaustion |
|---|---|
| `src/app/book/[id]/page.tsx:235` | Renders **nothing**. The score badge floats over empty space and the header layout collapses. |
| `src/app/shelf/page.tsx:193` | `return null` — no placeholder. |
| `src/components/MeetingCard.tsx:44` | Entire cover column disappears; card reflows to a text chip. Visible layout jump. |
| `src/components/BookShelf.tsx:40` | Falls back to spine-colour tile with title. ✅ Correct behaviour. |
| `src/app/members/page.tsx:129` | Falls back to spine-colour tile. ✅ |
| `src/app/page.tsx:153` | Falls back to spine-colour tile. ✅ |

### 1.7 `spine_color` is always random (CORS failure)

`src/lib/color-extract.ts:27` sets `img.crossOrigin = "anonymous"` before loading a `books.google.com` image. Google does **not** send an `Access-Control-Allow-Origin` header on cover images. The CORS-mode request therefore fails, `img.onerror` fires, and the function resolves to `getRandomWarmColor()`.

**Every `spine_color` in your database is a random palette pick, never derived from the cover.** That's why fallback tiles don't match their covers, and why the same book added twice gets two different colours.

Two further problems in the same function:

- **No timeout.** If the image neither loads nor errors, the promise never settles — `handleSelectBook` hangs on "Adding…" indefinitely with no way out.
- Even with CORS working, drawing to a **1×1 canvas** averages the entire cover including white margins, which reliably produces muddy grey.

### 1.8 Zoom-level probe script

Run this in your browser console on the deployed site (it needs a real browser origin, not a server) to pick the right zoom ordering for your actual library:

```js
// Paste in DevTools console on your deployed app.
const ids = ["<google_books_id_1>", "<google_books_id_2>" /* ... */];
const probe = (id, zoom) => new Promise(res => {
  const i = new Image();
  i.referrerPolicy = "no-referrer";
  i.onload  = () => res({ id, zoom, w: i.naturalWidth, h: i.naturalHeight });
  i.onerror = () => res({ id, zoom, w: 0, h: 0, error: true });
  i.src = `https://books.google.com/books/content?id=${id}&printsec=frontcover&img=1&zoom=${zoom}`;
});
Promise.all(ids.flatMap(id => [0,1,2,3].map(z => probe(id, z)))).then(r => console.table(r));
```

Pick the zoom that maximises `w` without erroring, per volume; use that to order `GOOGLE_ZOOM_ORDER` below.

---

## Fix 1 — Rewrite URL handling with the `URL` API

Regex surgery on query strings is the source of several of these bugs. Note that the *existing* strip regex is already subtly wrong:

```ts
url.replace(/([?&])edge=curl&?/, "$1")
// "...&zoom=3&edge=curl&source=gbs_api" → "...&zoom=3&source=gbs_api"  ✅
// but a trailing "&" is dropped inconsistently depending on parameter order
```

Replace the whole approach. **`src/lib/covers.ts` (new file):**

```ts
// Ordering is a starting point — confirm with the probe script in the audit §1.8.
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

/**
 * Rebuild a Google Books content URL at a given zoom, with the page-curl
 * artifact removed. `edge=curl` composites a fake folded page onto the
 * right edge — it is never what we want on a bookshelf.
 */
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
 * `default=false` makes Open Library return 404 for a missing cover.
 * Without it you get HTTP 200 and a 1x1 transparent GIF, which silently
 * renders as an invisible cover and never triggers onError.
 */
export function openLibraryCoverUrl(isbn: string, size: "S" | "M" | "L"): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false`;
}

export interface CoverIdentifiers {
  cover_url?: string | null;
  thumbnail_url?: string | null;
  isbn?: string | null;
  google_books_id?: string | null;
}

/** Ordered best → worst. Render candidates[0]; advance on failure. */
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
      push(url); // already a good direct URL (e.g. Open Library)
    }
  }

  // Reconstruct from the volume id when stored URLs are unusable.
  if (book.google_books_id) {
    for (const zoom of GOOGLE_ZOOM_ORDER) {
      push(googleCoverUrlFromId(book.google_books_id, zoom));
    }
  }

  // Second source — only reachable once `isbn` is persisted (see Fix 3).
  if (book.isbn) {
    push(openLibraryCoverUrl(book.isbn, "L"));
    push(openLibraryCoverUrl(book.isbn, "M"));
  }

  return out;
}
```

Then delete `getGoogleCoverVariants` and `getBookCoverCandidates` from `src/lib/utils.ts` and re-export from the new module, or update the six import sites.

---

## Fix 2 — One `<BookCover>` component for all six call sites

**`src/components/BookCover.tsx` (new file):**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { getBookCoverCandidates, type CoverIdentifiers } from "@/lib/covers";
import { getDeterministicSpineColor } from "@/lib/color-extract";

/**
 * Google serves a grey "image not available" bitmap with HTTP 200 rather
 * than a 404, so onError never fires for it. It is consistently tiny, so
 * an undersized decoded image is treated as a failure.
 */
const MIN_COVER_WIDTH = 60;

interface BookCoverProps {
  book: CoverIdentifiers & { id?: string; title: string; spine_color?: string | null };
  className?: string;
  /** Book covers vary in aspect ratio; "contain" avoids cropping artwork. */
  fit?: "contain" | "cover";
  eager?: boolean;
}

export default function BookCover({
  book,
  className = "",
  fit = "contain",
  eager = false,
}: BookCoverProps) {
  const candidates = useMemo(
    () => getBookCoverCandidates(book),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [book.cover_url, book.thumbnail_url, book.isbn, book.google_books_id]
  );
  const [index, setIndex] = useState(0);

  useEffect(() => setIndex(0), [candidates]);

  const src = candidates[index];
  const bg = book.spine_color || getDeterministicSpineColor(book.title);

  if (!src) {
    return (
      <div
        className={`${className} flex items-center justify-center p-2 overflow-hidden`}
        style={{ backgroundColor: bg }}
        role="img"
        aria-label={`No cover available for ${book.title}`}
      >
        <p className="font-serif text-cream text-xs text-center leading-tight line-clamp-4">
          {book.title}
        </p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`Cover of ${book.title}`}
      className={`${className} ${fit === "contain" ? "object-contain" : "object-cover"}`}
      style={{ backgroundColor: bg }}
      referrerPolicy="no-referrer"
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      onError={() => setIndex((i) => i + 1)}
      onLoad={(e) => {
        if (e.currentTarget.naturalWidth < MIN_COVER_WIDTH) setIndex((i) => i + 1);
      }}
    />
  );
}
```

**Replace at all six sites**, deleting the local `useState`/`onError` duplication:

| File | Line | Replace |
|---|---|---|
| `src/app/page.tsx` | 153-169 | `<BookCover book={currentBook} className="w-20 h-28 rounded-lg shadow-lg flex-shrink-0" eager />` |
| `src/app/shelf/page.tsx` | 188-204 | Delete `UpcomingBookCover`; use `<BookCover book={book} className="w-12 h-16 rounded shadow-sm flex-shrink-0" />` |
| `src/app/book/[id]/page.tsx` | 235-243 | `<BookCover book={book} className="w-48 h-72 rounded-lg shadow-xl" eager />` |
| `src/app/calendar/page.tsx` | 229-243 | `<BookCover book={selectedBook} className="w-14 h-20 rounded shadow-md flex-shrink-0" />` |
| `src/components/MeetingCard.tsx` | 44-57 | `<BookCover book={meeting.book} className="w-full h-full" />` |
| `src/components/BookShelf.tsx` | 26-121 | `BookTile`/`FeaturedBook` — see also Fix 2b |
| `src/app/members/page.tsx` | 112-153 | `MemberBookTile` |

**Fix 2b — the positioning bug in `BookShelf.tsx`.** In both `BookTile` (line 41) and `FeaturedBook` (line 102) the `<img>` carries `absolute inset-0`, but its **immediate parent has no `relative`**. The image positions against the grandparent instead. It currently *looks* fine only because the two boxes happen to coincide; any padding change to the grandparent will break it. `<BookCover>` uses normal flow and removes the hazard entirely — just size it with the same width/height classes.

**Fix 2c — `object-cover` → `object-contain`.** Five of six sites use `object-cover` on a fixed 2:3 box, cropping any cover that isn't exactly 2:3 (most aren't). `MeetingCard` already uses `object-contain`. Standardise on `contain` with the spine colour as the letterbox background — that's the `<BookCover>` default above.

---

## Fix 3 — Persist ISBN so the second source is reachable

**Migration (run in the Supabase SQL editor):**

```sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn text;
CREATE INDEX IF NOT EXISTS books_isbn_idx ON books (isbn);
```

**`src/types/index.ts`** — add to `Book`:

```ts
isbn: string | null;
```

**`src/components/BookSearch.tsx`** — `handleSelectBook`, around line 112:

```ts
const bookData: Record<string, unknown> = {
  title: vol.volumeInfo.title,
  author: vol.volumeInfo.authors?.join(", ") || null,
  cover_url: coverUrl,
  thumbnail_url: thumbnailUrl,
  isbn,                              // ← add: makes Open Library reachable at render time
  spine_color: spineColor,
  google_books_id: result.id,
  status: "upcoming",
  added_by: memberId,
};
```

**Backfill existing books** — one-off script, run once from the browser console on the deployed app:

```js
// Backfills isbn for books that have a google_books_id but no isbn.
const { data } = await supabase.from("books")
  .select("id,google_books_id").is("isbn", null).not("google_books_id", "is", null);
for (const b of data ?? []) {
  const r = await fetch(`https://www.googleapis.com/books/v1/volumes/${b.google_books_id}`);
  if (!r.ok) continue;
  const ids = (await r.json())?.volumeInfo?.industryIdentifiers ?? [];
  const isbn = ids.find(i => i.type === "ISBN_13")?.identifier
            ?? ids.find(i => i.type === "ISBN_10")?.identifier;
  if (isbn) await supabase.from("books").update({ isbn }).eq("id", b.id);
  await new Promise(r => setTimeout(r, 250)); // stay under the rate limit
}
```

---

## Fix 4 — Replace canvas colour extraction with a deterministic hash

Canvas extraction cannot work against `books.google.com` without a same-origin proxy. Stop pretending it does.

**`src/lib/color-extract.ts`** — replace `extractDominantColor` with:

```ts
/**
 * Canvas extraction is not possible here: books.google.com sends no
 * Access-Control-Allow-Origin header, so a crossOrigin="anonymous" load
 * always fails and the canvas would be tainted regardless. A stable hash
 * of the title gives a consistent, non-random colour per book instead.
 */
export function getDeterministicSpineColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return WARM_PALETTE[Math.abs(hash) % WARM_PALETTE.length];
}
```

**`src/components/BookSearch.tsx:103-110`** becomes:

```ts
const spineColor = getDeterministicSpineColor(vol.volumeInfo.title);
```

This also removes the **unbounded hang** in `handleSelectBook`: `extractDominantColor` had no timeout, so an image that never fired `load` or `error` left the "Adding…" spinner stuck forever.

> If you genuinely want cover-derived colours later, the only correct route is a Next.js route handler (`app/api/cover/route.ts`) that proxies the image server-side and extracts the colour there. That also solves hotlinking. It's a worthwhile follow-up, not a prerequisite.

---

## Fix 5 — `next.config.mjs` `remotePatterns` is dead config

`next/image` is imported **nowhere** in the codebase (verified by grep) — every cover is a plain `<img>`. The `images.remotePatterns` block therefore does nothing.

Keep it only if you intend to migrate to `next/image`. If you do migrate, add `covers.openlibrary.org` is already there but you'd also need `books.googleusercontent.com` (Google sometimes redirects there), and be aware that Next's optimizer fetches server-side, where `referrerPolicy="no-referrer"` does not apply — you'd need `unoptimized` or a custom loader. **Recommendation: stay on `<img>`, delete the block, and note why.**

---

# Part 2 — Schema drift (R3)

The `books` schema in `README.md:41-55` defines `total_pages`. The application code reads and writes **`page_count`** and **`completed_at`**, neither of which exists in the documented schema.

Evidence of the workaround already in the codebase — `BookSearch.tsx:132-140`:

```ts
// If page_count column doesn't exist, retry without it
if (error && bookData.page_count) { delete bookData.page_count; /* retry */ }
```

That hack rescues the insert, but three other paths fail silently:

- `src/app/page.tsx:52` — `.select("id,page_count,total_pages,google_books_id")` **errors the whole query** if `page_count` is absent. `error` is discarded, `data` is `null`, so "Total Pages Read" never renders.
- `src/app/book/[id]/page.tsx:58-62` — the `page_count` backfill update fails silently.
- `src/app/book/[id]/page.tsx:327` — `book.completed_at` is always `undefined`, so "Read <month year>" never appears.

**Migration:**

```sql
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Consolidate the two page columns onto page_count.
UPDATE books SET page_count = total_pages
  WHERE page_count IS NULL AND total_pages IS NOT NULL;

-- Prevent the same book being added twice (no uniqueness exists today).
CREATE UNIQUE INDEX IF NOT EXISTS books_google_books_id_key
  ON books (google_books_id) WHERE google_books_id IS NOT NULL;
```

Then update `README.md`'s canonical schema block and `DATABASE.md` to match — per the maintenance rule in `docs/PROJECT_MEMORY.md:13`. Once backfilled, drop `total_pages` from the `Book` type and delete the dual-column handling in `getExactPageCount`.

**`completed_at` is never set.** `src/app/shelf/page.tsx:107-110` and `src/app/book/[id]/page.tsx:283-287` both flip a book to `completed` without a timestamp:

```ts
// shelf/page.tsx:107 — add completed_at
await supabase.from("books")
  .update({ status: "completed", completed_at: new Date().toISOString() })
  .eq("id", currentlyReading.id);
```

---

# Part 3 — Correctness bugs

### 3.1 A post-rating of exactly `0` can never be saved

`src/app/book/[id]/page.tsx:153`:

```ts
if (changed && !pendingPostValue) {
  setPendingPostValue(value);
  return;
}
```

`0` is a valid rating (the slider is `min="0"`) and is falsy. Setting a post-rating of `0` sets `pendingPostValue = 0`, which keeps `!pendingPostValue` true, so the guard re-triggers on every attempt and **the rating is never written**. The same flaw gates the JSX at lines 425 and 511 (`{!pendingPostValue ? <RatingSlider/> : ...}`), so the reason prompt never appears either.

```ts
// Use an explicit null check — 0 is a valid rating.
if (changed && pendingPostValue === null) {
  setPendingPostValue(value);
  return;
}
```

...and in the JSX: `{pendingPostValue === null ? <RatingSlider .../> : ( ... )}`

### 3.2 Editing your pre-rating silently re-hides it

`src/app/book/[id]/page.tsx:128-136` upserts with `is_visible: false` hardcoded. If you have already revealed your rating and then edit it, the upsert resets `is_visible` to `false` — your rating vanishes from the group view with no indication.

```ts
.upsert(
  {
    book_id: bookId,
    member_id: currentMember.id,
    pre_rating: value,
    // Preserve the existing choice; only default to hidden for a new row.
    is_visible: myRating?.is_visible ?? false,
  },
  { onConflict: "book_id,member_id" }
)
```

### 3.3 `.single()` on a possibly-empty result

`src/app/page.tsx:32-37` — `.eq("status","reading").limit(1).single()`. When no book is being read, PostgREST returns `PGRST116` and a 406 in the network tab. It's masked because `error` is discarded. Use `.maybeSingle()`.

### 3.4 Status dropdown omits `upcoming`

`src/app/book/[id]/page.tsx:294-298` offers only `reading` and `completed`. For a book with `status === "upcoming"`, `value` matches no `<option>`, so the browser displays "Currently Reading" while the database says `upcoming`. Add `<option value="upcoming">Upcoming</option>`.

### 3.5 `RatingSlider` ignores changes to `initialValue`

`src/components/RatingSlider.tsx:20` — `useState(initialValue ?? 5)` captures only the first value. When the parent re-renders with a different `initialValue` (e.g. switching from edit-pre to edit-post), the thumb doesn't move. Add a `key` at the call sites, or sync with an effect.

### 3.6 Stale member in localStorage

`src/components/MemberProvider.tsx:27-31` trusts the stored member without revalidating it against the DB. If that member was deleted, every insert with `added_by`/`member_id` fails on the foreign key — silently, per R4. Re-fetch the member by id on mount and clear localStorage if it 404s.

---

# Part 4 — Error handling & performance

### 4.1 Discard-the-error is the reason failures are invisible (R4)

24 call sites across 7 files destructure only `data`. Add a shared helper:

**`src/lib/db.ts` (new file):**

```ts
import type { PostgrestError } from "@supabase/supabase-js";

export function unwrap<T>(
  res: { data: T | null; error: PostgrestError | null },
  context: string
): T | null {
  if (res.error) {
    console.error(`[supabase] ${context}:`, res.error.message, res.error.code);
    return null;
  }
  return res.data;
}
```

Wrap each query: `const books = unwrap(await supabase.from("books").select("*"), "fetch books");`. Surfacing a missing column or an RLS denial in the console is the single highest-leverage change for future debugging.

### 4.2 N+1 query on the shelf

`src/app/shelf/page.tsx:46-64` runs one sequential query **per completed book**. Twenty books = twenty serial round-trips before the shelf renders. Collapse to one:

```ts
const ids = completed.map((b) => b.id);
const { data: ratings } = await supabase
  .from("ratings")
  .select("book_id, pre_rating, post_rating")
  .in("book_id", ids)
  .eq("is_visible", true);

const byBook = new Map<string, number[]>();
for (const r of ratings ?? []) {
  const v = r.post_rating ?? r.pre_rating;
  if (v === null) continue;
  byBook.set(r.book_id, [...(byBook.get(r.book_id) ?? []), v]);
}
```

`src/app/members/page.tsx:55-59` has the same pattern — one attendance count query per member. Fetch all `going` rows once and tally client-side.

### 4.3 The home page hammers Google Books on every visit

`src/app/page.tsx:56-83` runs an unthrottled `Promise.all` backfill of page counts for **every** completed book missing one, on **every page load, for every visitor**. Without an API key the Google Books quota is per-IP and low — I hit a `429` from this sandbox on a single request. Once a book has no page count in either source, it is retried forever.

- Move the backfill out of the render path — a one-off script, or a `completed`-status trigger.
- Add a `page_count_checked_at` column so a miss isn't retried indefinitely.
- Set `NEXT_PUBLIC_GOOGLE_BOOKS_KEY` in Vercel, and **restrict it by HTTP referrer** in the Google Cloud console — it ships to the browser by design (`NEXT_PUBLIC_`), so referrer restriction is the only thing protecting your quota.

### 4.4 Debug logging in production

`src/app/page.tsx:72,89` and `src/components/BookSearch.tsx:93` log to the console on every load. Remove or gate behind `process.env.NODE_ENV !== "production"`.

---

# Part 5 — Security

### 5.1 `dangerouslySetInnerHTML` with third-party HTML

`src/app/book/[id]/page.tsx:334` injects the Google Books `description` verbatim. Google descriptions legitimately contain HTML (`<p>`, `<br>`, `<i>`), so stripping everything would degrade the page — but injecting unsanitised third-party HTML is an XSS sink.

Add `isomorphic-dompurify` and sanitise with an allowlist:

```ts
import DOMPurify from "isomorphic-dompurify";

dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(description, {
    ALLOWED_TAGS: ["p", "br", "b", "i", "em", "strong"],
    ALLOWED_ATTR: [],
  }),
}}
```

### 5.2 RLS is `USING (true)` on every table

Documented as intentional for a trusted private club, and that's a defensible call for six friends. Be aware of what it means: anyone who reads the anon key from your JS bundle can read and delete every row. If the app ever goes public, this is the first thing to change.

---

# Part 6 — Design drift & augmentations

### 6.1 `BookSpine.tsx` is dead code

Verified by grep: `BookSpine` is imported nowhere. `CLAUDE.md` describes past reads rendering as 3D spines, and `globals.css:262-264` still ships the `.book-spine:hover` pull-out animation — but `BookShelf.tsx` renders `BookTile` (flat cover images) for past reads.

Decide and then align the docs:
- **Keep covers** (current behaviour) → delete `BookSpine.tsx`, drop the `.book-spine`/`.spine-text` CSS, update `CLAUDE.md`.
- **Restore spines** → render `BookSpine` for past reads. Note this makes `spine_color` load-bearing, so Fix 4 becomes a prerequisite rather than a nicety.

Given that the whole point is *remembering* books, covers are more recognisable than spines. My recommendation: keep covers, delete the spine code, and get the visual richness back from the shelf framing you already have.

### 6.2 Smaller improvements, roughly in value order

1. **Duplicate books.** No uniqueness on `google_books_id` — the unique index in Part 2 fixes this; also grey out already-added books in `BookSearch` results.
2. **Horizontal scroll affordance.** `BookShelf.tsx:168` and `members/page.tsx:278` use `scrollbar-hide` on scrollable rows with no visual cue that more content exists. Add a fade mask on the right edge.
3. **`BookSearch` has no error state.** `searchBooks()` swallows every failure and returns `[]` (`google-books.ts:30`), so a rate-limit or network error is indistinguishable from "no results". Return a discriminated result and show "Search is unavailable — try again".
4. **No loading skeletons.** Every page renders empty then pops. `book/[id]` at least shows "Loading…"; the shelf and calendar don't.
5. **`alt=""` on the home page cover** (`page.tsx:156`) — `<BookCover>` fixes this with a real alt.
6. **Optimistic RSVP.** `handleRsvp` waits for a round-trip before any UI change; the buttons feel unresponsive. Update local state first, reconcile on the realtime event.
7. **`WelcomeModal` is dismissible into a dead end** — a member who closes it has `currentMember === null` and every write control silently disappears.
8. **Timezone handling.** `formatDate` does `new Date(s + "T00:00:00")` — parsed as *local* time, while `page.tsx:40` compares against a UTC-derived `toISOString().split("T")[0]`. Near midnight, a meeting can appear in the wrong bucket. Pick one and use it consistently.

---

# Prioritised action plan

### Phase 1 — Covers (the reported problem) · ~4 hours
1. Add `src/lib/covers.ts` (Fix 1) — strips `edge=curl`, correct URL handling.
2. Add `src/components/BookCover.tsx` (Fix 2); replace all six call sites; switch to `object-contain`.
3. Run the migration + backfill for `isbn` (Fix 3).
4. Replace canvas extraction with the deterministic hash (Fix 4) — also fixes the "Adding…" hang.
5. Run the zoom probe (§1.8) against your real library and lock in `GOOGLE_ZOOM_ORDER`.

**Expected result:** no page-curl artifacts, sharper covers, consistent appearance, a real second source, and a proper typographic placeholder when both sources miss.

### Phase 2 — Make failures visible · ~2 hours
6. Add `src/lib/db.ts` and wrap all 24 query sites (4.1).
7. Run the `page_count` / `completed_at` migration; update `README.md` + `DATABASE.md` (Part 2).
8. Set `completed_at` when marking a book complete.

### Phase 3 — Correctness · ~2 hours
9. The `pendingPostValue === null` fix (3.1) — a rating of 0 is currently unsavable.
10. Preserve `is_visible` on pre-rating edits (3.2).
11. `.maybeSingle()` (3.3); add the `upcoming` option (3.4).

### Phase 4 — Performance & hardening · ~3 hours
12. Collapse the two N+1 queries (4.2).
13. Move the page-count backfill off the render path; add and restrict the Google Books API key (4.3).
14. Sanitise the description HTML (5.1).
15. Delete `BookSpine.tsx` + dead CSS + dead `remotePatterns`; align `CLAUDE.md` (6.1, Fix 5).

---

## Verification checklist

- [ ] `npm run build` still exits 0.
- [ ] Cover URLs in DevTools → Network contain **no** `edge=curl`.
- [ ] A book with no cover in either source shows the typographic placeholder, not a blank box.
- [ ] The book detail page never renders a bare score badge over empty space.
- [ ] Adding a book completes in < 3s and never hangs on "Adding…".
- [ ] Submitting a post-rating of exactly `0.0` persists.
- [ ] Editing a revealed pre-rating leaves it revealed.
- [ ] The shelf issues one ratings query, not one per book (check the Network tab).
- [ ] Home page loads without firing Google Books requests once page counts are backfilled.

## Things I could not verify

- **Live zoom behaviour.** Outbound access to `books.google.com` returned 403 and `googleapis.com` returned 429 from this sandbox, so `GOOGLE_ZOOM_ORDER` is a reasoned starting point, not a measured one. Run §1.8.
- **Your live schema.** The drift analysis is based on `README.md`'s canonical block versus the code. If you have already applied `page_count`/`completed_at` by hand, Part 2 is a no-op — the `IF NOT EXISTS` clauses make it safe to run either way.
