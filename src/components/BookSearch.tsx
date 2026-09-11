"use client";

import { useState, useEffect, useRef } from "react";
import { searchBooks, fetchVolumeById, getBookCoverUrl, getThumbnailUrl, getISBN } from "@/lib/google-books";
import { fetchOpenLibraryByISBN } from "@/lib/open-library";
import { openLibraryCoverUrl, googleCoverUrl, resolveCoverUrl } from "@/lib/covers";
import { getDeterministicSpineColor } from "@/lib/color-extract";
import { supabase } from "@/lib/supabase";
import { GoogleBooksResult, Book } from "@/types";
import { Button, inputClass } from "./ui";

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
    const missing = OPTIONAL_BOOK_COLUMNS.find((col) => col in payload && error.message.includes(col));
    if (!missing) {
      console.error("[supabase] insert book:", error.message, error.code);
      return { data: null, error };
    }
    delete payload[missing];
  }
  return { data: null, error: null };
}

interface BookSearchProps {
  memberId: string;
  onBookAdded: (book: Book) => void;
  onClose: () => void;
}

export default function BookSearch({ memberId, onBookAdded, onClose }: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBooksResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [addStep, setAddStep] = useState<string>("");
  const [hasSearched, setHasSearched] = useState(false);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Grey out books already on the shelf.
  useEffect(() => {
    supabase
      .from("books")
      .select("google_books_id")
      .then(({ data }) => {
        setExistingIds(new Set((data || []).map((b) => b.google_books_id).filter(Boolean)));
      });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    if (query.trim().length < 2) return;
    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      setResults(await searchBooks(query));
      setIsSearching(false);
      setHasSearched(true);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  async function handleSelect(result: GoogleBooksResult) {
    if (existingIds.has(result.id)) return;
    setAdding(result.id);
    setAddStep("Fetching details");

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

    // Resolve the work-level cover once and store the winner.
    setAddStep("Finding the cover");
    const resolved = await resolveCoverUrl({ google_books_id: result.id, isbn, title, author });
    if (resolved) {
      coverUrl = resolved;
      thumbnailUrl = resolved;
    }

    setAddStep("Adding to the shelf");
    const bookData: Record<string, unknown> = {
      title,
      author,
      cover_url: coverUrl,
      thumbnail_url: thumbnailUrl,
      isbn,
      spine_color: getDeterministicSpineColor(title),
      google_books_id: result.id,
      status: "upcoming",
      added_by: memberId,
    };
    if (pageCount) bookData.page_count = pageCount;

    const { data } = await insertBook(bookData);
    if (data) onBookAdded(data);
    setAdding(null);
    setAddStep("");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-charcoal/50 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-cream w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[88vh] sm:max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add a book"
      >
        <div className="px-5 pt-5 pb-3 sm:px-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-2xl text-charcoal tracking-tight">Add a book</h2>
            <button
              onClick={onClose}
              className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-warm-brown hover:bg-charcoal/5 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-warm-brown/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title or author"
              className={`${inputClass} pl-10 pr-10 h-12 text-base`}
              autoFocus
              autoComplete="off"
            />
            {isSearching && (
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4 sm:px-4">
          {results.length > 0 && (
            <ul className="space-y-1">
              {results.map((r) => {
                const onShelf = existingIds.has(r.id);
                const isThis = adding === r.id;
                const thumb = r.volumeInfo.imageLinks?.smallThumbnail
                  ? googleCoverUrl(r.volumeInfo.imageLinks.smallThumbnail, 1) || r.volumeInfo.imageLinks.smallThumbnail
                  : null;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => handleSelect(r)}
                      disabled={Boolean(adding) || onShelf}
                      className="w-full flex items-center gap-4 p-2.5 rounded-2xl hover:bg-white/70 transition-colors text-left disabled:cursor-default"
                    >
                      <div className="w-12 aspect-[2/3] rounded-md bg-charcoal/[0.06] overflow-hidden flex-shrink-0 shadow-sm">
                        {thumb && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={thumb}
                            alt=""
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                            style={onShelf ? { filter: "saturate(0.3) opacity(0.5)" } : undefined}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`font-serif text-[15px] leading-snug line-clamp-2 ${onShelf ? "text-warm-brown/60" : "text-charcoal"}`}>
                          {r.volumeInfo.title}
                        </p>
                        {r.volumeInfo.authors && (
                          <p className="font-sans text-xs text-warm-brown mt-0.5 truncate">
                            {r.volumeInfo.authors.join(", ")}
                          </p>
                        )}
                        {onShelf && (
                          <p className="font-sans text-[11px] text-gold mt-0.5">Already on the shelf</p>
                        )}
                      </div>
                      {isThis ? (
                        <span className="font-sans text-xs text-gold flex-shrink-0 whitespace-nowrap">
                          {addStep}…
                        </span>
                      ) : !onShelf ? (
                        <span className="w-8 h-8 rounded-full bg-mahogany/[0.08] text-mahogany flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {results.length === 0 && !isSearching && hasSearched && (
            <p className="text-center font-sans text-sm text-warm-brown/70 py-10">
              Nothing found. Try the author&apos;s name.
            </p>
          )}

          {!hasSearched && !isSearching && query.trim().length < 2 && (
            <p className="text-center font-sans text-sm text-warm-brown/60 py-10">
              Start typing to search every book in print.
            </p>
          )}
        </div>

        {adding && (
          <div className="px-5 py-3 border-t border-charcoal/[0.06] bg-white/50">
            <p className="font-sans text-xs text-warm-brown text-center">{addStep}…</p>
          </div>
        )}
        <div className="hidden sm:block" />
        <Button variant="ghost" className="sm:hidden mx-4 mb-4" onClick={onClose}>
          Close
        </Button>
      </div>
    </div>
  );
}
