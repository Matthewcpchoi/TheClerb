"use client";

import { useState, useEffect, useRef } from "react";
import { searchBooks, getBookCoverUrl, getThumbnailUrl } from "@/lib/google-books";
import { extractDominantColor } from "@/lib/color-extract";
import { supabase } from "@/lib/supabase";
import { GoogleBooksResult, Book } from "@/types";

interface BookSearchProps {
  memberId: string;
  onBookAdded: (book: Book) => void;
  onClose: () => void;
}

export default function BookSearch({
  memberId,
  onBookAdded,
  onClose,
}: BookSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleBooksResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search-as-you-type
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    if (query.trim().length < 2) return;

    setIsSearching(true);
    debounceRef.current = setTimeout(async () => {
      const data = await searchBooks(query);
      setResults(data);
      setIsSearching(false);
      setHasSearched(true);
    }, 350);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query]);

  async function handleSelectBook(result: GoogleBooksResult) {
    setIsAdding(result.id);
    const coverUrl = getBookCoverUrl(result);
    const thumbnailUrl = getThumbnailUrl(result);

    let spineColor = "#3C1518";
    if (thumbnailUrl) {
      try {
        spineColor = await extractDominantColor(thumbnailUrl);
      } catch {
        // Use default
      }
    }

    const bookData: Record<string, unknown> = {
      title: result.volumeInfo.title,
      author: result.volumeInfo.authors?.join(", ") || null,
      cover_url: coverUrl,
      thumbnail_url: thumbnailUrl,
      spine_color: spineColor,
      google_books_id: result.id,
      status: "upcoming",
      added_by: memberId,
    };
    if (result.volumeInfo.pageCount) {
      bookData.page_count = result.volumeInfo.pageCount;
    }

    let { data, error } = await supabase
      .from("books")
      .insert(bookData)
      .select()
      .single();

    // If page_count column doesn't exist, retry without it
    if (error && bookData.page_count) {
      delete bookData.page_count;
      ({ data, error } = await supabase
        .from("books")
        .insert(bookData)
        .select()
        .single());
    }

    if (data && !error) {
      onBookAdded(data);
    }
    setIsAdding(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-mahogany/60 backdrop-blur-sm">
      <div className="bg-cream rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[80vh] flex flex-col">
        <div className="px-6 py-4 border-b border-cream-dark flex items-center justify-between">
          <h2 className="font-serif text-xl text-charcoal">Add a Book</h2>
          <button
            onClick={onClose}
            className="text-warm-brown hover:text-mahogany transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="p-6 pb-3">
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Start typing a title or author..."
              className="w-full px-4 py-3 pr-10 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
              </div>
            )}
          </div>
          {query.trim().length > 0 && query.trim().length < 2 && (
            <p className="text-xs text-warm-brown/50 font-sans mt-2">
              Keep typing to search...
            </p>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {results.length > 0 && (
            <div className="space-y-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleSelectBook(result)}
                  disabled={isAdding === result.id}
                  className="w-full flex items-start gap-4 p-3 rounded-lg border border-cream-dark hover:border-gold hover:bg-gold/5 transition-all text-left disabled:opacity-50"
                >
                  {result.volumeInfo.imageLinks?.smallThumbnail ? (
                    <img
                      src={result.volumeInfo.imageLinks.smallThumbnail.replace(
                        "http://",
                        "https://"
                      )}
                      alt={result.volumeInfo.title}
                      className="w-12 h-18 object-cover rounded shadow flex-shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-12 h-16 bg-mahogany/20 rounded flex-shrink-0 flex items-center justify-center">
                      <svg className="w-5 h-5 text-mahogany/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                      </svg>
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-serif text-sm text-charcoal font-semibold truncate">
                      {result.volumeInfo.title}
                    </p>
                    {result.volumeInfo.authors && (
                      <p className="font-sans text-xs text-warm-brown mt-0.5">
                        {result.volumeInfo.authors.join(", ")}
                      </p>
                    )}
                    {result.volumeInfo.pageCount && (
                      <p className="font-sans text-xs text-warm-brown/50 mt-0.5">
                        {result.volumeInfo.pageCount} pages
                      </p>
                    )}
                  </div>
                  {isAdding === result.id && (
                    <span className="font-sans text-xs text-gold flex-shrink-0">
                      Adding...
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {results.length === 0 && !isSearching && hasSearched && (
            <p className="text-center text-warm-brown/60 font-sans text-sm py-8">
              No results found. Try a different search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
