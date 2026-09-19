"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import { fetchVolumeById, searchBooks, getISBN } from "@/lib/google-books";
import { getBookCoverCandidates, resolveCoverUrl } from "@/lib/covers";
import BookCover from "@/components/BookCover";

/**
 * Cover repair.
 *
 * Books are stored with whatever cover URL the Google Books *search* endpoint
 * returned when they were added. That endpoint uses a "lite" projection which
 * sometimes omits imageLinks entirely, so those books were saved with a null
 * cover_url and no ISBN — and no amount of render-time fallback logic can
 * recover a cover from a row that holds no identifiers.
 *
 * This page re-resolves each book against the full volume endpoint (and a
 * title/author search when the stored volume id yields nothing) and writes
 * cover_url, thumbnail_url and isbn back to the row.
 */

type RepairState = "pending" | "working" | "fixed" | "already-ok" | "failed";

interface Row {
  book: Book;
  state: RepairState;
  note?: string;
}

function bestImageLink(links?: Record<string, string>): string | null {
  if (!links) return null;
  const raw =
    links.extraLarge ||
    links.large ||
    links.medium ||
    links.thumbnail ||
    links.smallThumbnail;
  return raw ? raw.replace("http://", "https://") : null;
}

interface DebugResponse {
  workCandidates?: string[];
  searchCandidates?: string[];
  lastResortCandidates?: string[];
}

/**
 * Lets a wrong-but-valid cover be corrected by hand. Automatic resolution can
 * return a real image that is simply the wrong edition's art, which no byte
 * inspection can detect — only a person looking at it can.
 */
function CoverPicker({
  book,
  onChosen,
}: {
  book: Book;
  onChosen: (url: string) => void;
}) {
  const [options, setOptions] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadOptions() {
    setLoading(true);
    const params = new URLSearchParams({ debug: "1" });
    if (book.google_books_id) params.set("gid", book.google_books_id);
    if (book.isbn) params.set("isbn", book.isbn);
    if (book.title) params.set("title", book.title);
    if (book.author) params.set("author", book.author);

    try {
      const res = await fetch(`/api/cover?${params}`);
      const data: DebugResponse = await res.json();
      setOptions([
        ...(data.workCandidates || []),
        ...(data.searchCandidates || []),
        ...(data.lastResortCandidates || []),
      ]);
    } catch {
      setOptions([]);
    }
    setLoading(false);
  }

  if (options === null) {
    return (
      <button
        onClick={loadOptions}
        disabled={loading}
        className="px-3 py-1 rounded text-xs bg-tan/40 text-green hover:bg-tan/60 transition-colors disabled:opacity-50"
      >
        {loading ? "Loading…" : "Pick cover"}
      </button>
    );
  }

  if (options.length === 0) {
    return (
      <span className="text-xs text-muted">no options</span>
    );
  }

  return (
    <div className="w-full mt-3">
      <p className="text-xs text-muted mb-2">
        Tap the correct cover:
      </p>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {options.map((url) => (
          <button
            key={url}
            onClick={() => onChosen(url)}
            className="flex-shrink-0 rounded border-2 border-transparent hover:border-green transition-colors"
            title={url}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt="Cover option"
              className="w-16 h-24 object-contain bg-tan/40 rounded"
              referrerPolicy="no-referrer"
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function CoverRepairPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [running, setRunning] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("books")
      .select("*")
      .order("created_at", { ascending: false });
    setRows(
      (data || []).map((book: Book) => ({
        book,
        state: book.cover_url || book.thumbnail_url ? "already-ok" : "pending",
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function repair(row: Row): Promise<Row> {
    const { book } = row;

    // 1. Full volume record for the stored id — this is where imageLinks and
    //    industryIdentifiers actually live.
    let volume = book.google_books_id
      ? await fetchVolumeById(book.google_books_id)
      : null;

    // 2. Nothing usable? Search by title and author instead.
    if (!volume || !bestImageLink(volume.volumeInfo.imageLinks)) {
      const terms = [book.title, book.author].filter(Boolean).join(" ");
      const results = await searchBooks(terms);
      const hit = results.find((r) => bestImageLink(r.volumeInfo.imageLinks));
      if (hit) volume = (await fetchVolumeById(hit.id)) || hit;
    }

    if (!volume) {
      return { ...row, state: "failed", note: "no matching volume found" };
    }

    const isbn = getISBN(volume);

    // Work-level resolution, the same path the add flow uses. Falls back to
    // Google's volume art only if every other provider misses.
    const coverUrl =
      (await resolveCoverUrl({
        google_books_id: volume.id,
        isbn,
        title: volume.volumeInfo.title,
        author: volume.volumeInfo.authors?.join(", ") || null,
      })) || bestImageLink(volume.volumeInfo.imageLinks);

    if (!coverUrl && !isbn) {
      return { ...row, state: "failed", note: "no cover or ISBN available" };
    }

    const update: Record<string, unknown> = {};
    if (coverUrl) {
      update.cover_url = coverUrl;
      update.thumbnail_url = coverUrl;
    }
    if (volume !== null && book.google_books_id !== volume.id) {
      update.google_books_id = volume.id;
    }

    // isbn may not exist yet; retry without it rather than losing the cover.
    let { error } = await supabase
      .from("books")
      .update(isbn ? { ...update, isbn } : update)
      .eq("id", book.id);

    if (error && isbn) {
      ({ error } = await supabase
        .from("books")
        .update(update)
        .eq("id", book.id));
    }

    if (error) {
      return { ...row, state: "failed", note: error.message };
    }

    return {
      ...row,
      book: { ...book, ...(update as Partial<Book>), isbn: isbn ?? book.isbn },
      state: "fixed",
      note: coverUrl ? "cover URL written" : "ISBN written",
    };
  }

  async function repairAll() {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].state === "fixed") continue;
      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, state: "working" } : r))
      );
      const result = await repair(rows[i]);
      setRows((prev) => prev.map((r, idx) => (idx === i ? result : r)));
      // Stay well under the Google Books anonymous rate limit.
      await new Promise((r) => setTimeout(r, 400));
    }
    setRunning(false);
  }

  async function chooseCover(book: Book, url: string) {
    const { error } = await supabase
      .from("books")
      .update({ cover_url: url, thumbnail_url: url })
      .eq("id", book.id);

    setRows((prev) =>
      prev.map((r) =>
        r.book.id === book.id
          ? error
            ? { ...r, state: "failed", note: error.message }
            : {
                ...r,
                book: { ...r.book, cover_url: url, thumbnail_url: url },
                state: "fixed",
                note: "cover chosen by hand",
              }
          : r
      )
    );
  }

  const missing = rows.filter(
    (r) => !r.book.cover_url && !r.book.thumbnail_url
  ).length;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-3xl sm:text-4xl text-ink tracking-tight mb-2">
        Cover repair
      </h1>
      <p className="text-sm text-muted mb-6">
        {rows.length} books · {missing} with no cover URL stored
      </p>

      <button
        onClick={repairAll}
        disabled={running || rows.length === 0}
        className="mb-8 px-5 py-2.5 rounded-lg bg-ink text-ground text-sm hover:bg-espresso transition-colors disabled:opacity-50"
      >
        {running ? "Repairing…" : "Re-resolve every cover"}
      </button>

      <div className="space-y-2">
        {rows.map((row) => (
          <div
            key={row.book.id}
            className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-tan bg-transparent"
          >
            <BookCover
              book={row.book}
              className="w-10 h-14 rounded flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-ink truncate">
                {row.book.title}
              </p>
              <p className="text-xs text-muted truncate">
                {getBookCoverCandidates(row.book).length} candidate URLs
                {row.book.isbn ? " · ISBN ✓" : " · no ISBN"}
                {row.book.google_books_id ? " · volume id ✓" : " · no volume id"}
              </p>
              {row.note && (
                <p className="text-xs text-muted truncate">
                  {row.note}
                </p>
              )}
            </div>
            <span
              className={`text-xs flex-shrink-0 ${
                row.state === "fixed"
                  ? "text-green"
                  : row.state === "failed"
                    ? "text-red-500"
                    : "text-muted"
              }`}
            >
              {row.state}
            </span>

            <CoverPicker
              book={row.book}
              onChosen={(url) => chooseCover(row.book, url)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
