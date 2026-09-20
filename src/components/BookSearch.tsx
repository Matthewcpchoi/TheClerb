"use client";

import { useState, useEffect, useRef } from "react";
import { searchBooks, fetchVolumeById, getBookCoverUrl, getThumbnailUrl, getISBN } from "@/lib/google-books";
import { fetchOpenLibraryByISBN } from "@/lib/open-library";
import { openLibraryCoverUrl, googleCoverUrl, resolveCoverUrl } from "@/lib/covers";
import { spineColor } from "@/lib/design";
import { supabase } from "@/lib/supabase";
import { GoogleBooksResult, Book } from "@/types";
import { Kicker } from "./ui";

/**
 * Columns that may not exist yet on an older `books` table. PostgREST names a
 * missing column in its error, so drop it and retry rather than failing.
 */
const OPTIONAL_BOOK_COLUMNS = ["isbn", "page_count"] as const;

async function insertBook(bookData: Record<string, unknown>) {
  const payload = { ...bookData };
  for (let attempt = 0; attempt <= OPTIONAL_BOOK_COLUMNS.length; attempt++) {
    const { data, error } = await supabase.from("books").insert(payload).select().single();
    if (!error) return { data, error: null };
    const missing = OPTIONAL_BOOK_COLUMNS.find((c) => c in payload && error.message.includes(c));
    if (!missing) {
      console.error("[supabase] insert book:", error.message, error.code);
      return { data: null, error };
    }
    delete payload[missing];
  }
  return { data: null, error: null };
}

/** Adding a book is not in the design — see the README's Gaps. */
export default function BookSearch({
  memberId,
  onBookAdded,
  onClose,
}: {
  memberId: string;
  onBookAdded: (book: Book) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBooksResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [step, setStep] = useState("");
  const [searched, setSearched] = useState(false);
  const [onShelf, setOnShelf] = useState<Set<string>>(new Set());
  const debounce = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    supabase
      .from("books")
      .select("google_books_id")
      .then(({ data }) =>
        setOnShelf(new Set((data || []).map((b) => b.google_books_id).filter(Boolean)))
      );
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    setSearching(true);
    debounce.current = setTimeout(async () => {
      setResults(await searchBooks(query));
      setSearching(false);
      setSearched(true);
    }, 300);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [query]);

  async function select(result: GoogleBooksResult) {
    if (onShelf.has(result.id)) return;
    setAdding(result.id);
    setStep("Fetching details");

    const vol = (await fetchVolumeById(result.id)) || result;
    const title = vol.volumeInfo.title;
    const author = vol.volumeInfo.authors?.join(", ") || null;
    const isbn = getISBN(vol);
    let coverUrl = getBookCoverUrl(vol);
    let thumbnailUrl = getThumbnailUrl(vol);
    let pageCount = vol.volumeInfo.pageCount ?? null;

    if (isbn) {
      if (!coverUrl) {
        coverUrl = openLibraryCoverUrl(isbn, "L");
        thumbnailUrl ||= openLibraryCoverUrl(isbn, "M");
      }
      if (!pageCount) {
        const ol = await fetchOpenLibraryByISBN(isbn);
        if (ol?.number_of_pages && ol.number_of_pages > 0) pageCount = ol.number_of_pages;
      }
    }

    setStep("Finding the cover");
    const resolved = await resolveCoverUrl({ google_books_id: result.id, isbn, title, author });
    if (resolved) {
      coverUrl = resolved;
      thumbnailUrl = resolved;
    }

    setStep("Adding");
    const bookData: Record<string, unknown> = {
      title,
      author,
      cover_url: coverUrl,
      thumbnail_url: thumbnailUrl,
      isbn,
      spine_color: spineColor(title),
      google_books_id: result.id,
      status: "upcoming",
      added_by: memberId,
    };
    if (pageCount) bookData.page_count = pageCount;

    const { data } = await insertBook(bookData);
    if (data) onBookAdded(data);
    setAdding(null);
    setStep("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[88vh] w-full max-w-[448px] flex-col rounded-t-[26px] bg-ground"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="px-5 pb-3 pt-5">
          <div className="flex items-baseline justify-between">
            <Kicker tone="green">
              Add a book
            </Kicker>
            <button onClick={onClose} className="text-[12px] text-muted">
              Close
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Title or author"
            autoFocus
            autoComplete="off"
            className="mt-3 w-full border-b border-tan bg-transparent py-2 text-[17px] text-ink outline-none placeholder:text-muted/60 focus:border-green"
          />
        </div>

        <div className="scrollbar-hide flex-1 overflow-y-auto px-5 pb-6">
          {searching && <p className="py-4 text-[12.5px] text-muted">Searching…</p>}

          {results.map((r) => {
            const already = onShelf.has(r.id);
            const busy = adding === r.id;
            const thumb = r.volumeInfo.imageLinks?.smallThumbnail
              ? googleCoverUrl(r.volumeInfo.imageLinks.smallThumbnail, 1) ||
                r.volumeInfo.imageLinks.smallThumbnail
              : null;
            return (
              <button
                key={r.id}
                onClick={() => select(r)}
                disabled={Boolean(adding) || already}
                className="row-line flex w-full items-center gap-3 py-[11px] text-left"
              >
                <div
                  className="h-[42px] w-[28px] flex-none overflow-hidden"
                  style={{ borderRadius: "1px 3px 3px 1px", background: spineColor(r.volumeInfo.title) }}
                >
                  {thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={thumb}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                      style={already ? { opacity: 0.45 } : undefined}
                    />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[14.5px] ${already ? "text-muted" : "text-ink"}`}>
                    {r.volumeInfo.title}
                  </p>
                  <p className="truncate text-[12px] text-muted">
                    {r.volumeInfo.authors?.join(", ")}
                  </p>
                </div>
                <span className="flex-none text-[11.5px] text-muted">
                  {busy ? step : already ? "On shelf" : "Add"}
                </span>
              </button>
            );
          })}

          {searched && !searching && results.length === 0 && (
            <p className="py-6 text-[12.5px] text-muted">Nothing found. Try the author&apos;s name.</p>
          )}
        </div>
      </div>
    </div>
  );
}
