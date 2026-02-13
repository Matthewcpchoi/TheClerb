"use client";

import { useState } from "react";
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

  async function handleSearch() {
    if (!query.trim()) return;
    setIsSearching(true);
    const data = await searchBooks(query);
    setResults(data);
    setIsSearching(false);
  }

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

    const { data, error } = await supabase
      .from("books")
      .insert({
        title: result.volumeInfo.title,
        author: result.volumeInfo.authors?.join(", ") || null,
        cover_url: coverUrl,
        thumbnail_url: thumbnailUrl,
        spine_color: spineColor,
        google_books_id: result.id,
        status: "upcoming",
        added_by: memberId,
      })
      .select()
      .single();

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

        <div className="p-6">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search by title or author..."
              className="flex-1 px-4 py-3 rounded-lg border border-cream-dark bg-white font-sans text-charcoal placeholder:text-warm-brown/50 focus:outline-none focus:border-gold focus:ring-1 focus:ring-gold"
              autoFocus
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-5 py-3 rounded-lg bg-mahogany text-cream font-sans text-sm hover:bg-espresso transition-colors disabled:opacity-50"
            >
              {isSearching ? "..." : "Search"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {results.length > 0 && (
            <div className="space-y-3">
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
                    />
                  ) : (
                    <div className="w-12 h-16 bg-mahogany/20 rounded flex-shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="font-serif text-sm text-charcoal font-semibold truncate">
                      {result.volumeInfo.title}
                    </p>
                    {result.volumeInfo.authors && (
                      <p className="font-sans text-xs text-warm-brown mt-0.5">
                        {result.volumeInfo.authors.join(", ")}
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

          {results.length === 0 && !isSearching && query && (
            <p className="text-center text-warm-brown/60 font-sans text-sm py-8">
              No results found. Try a different search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
