import { supabase } from "@/lib/supabase";
import { Book } from "@/types";
import { isGoogleBooks, resolveCoverUrl } from "@/lib/covers";

/**
 * Mark a book completed, stamping completed_at so the book detail page can
 * show when the club read it.
 *
 * completed_at may not exist on an older `books` table, so the write falls
 * back to a plain status update rather than failing outright.
 */
export async function markCompleted(bookId: string): Promise<void> {
  const { error } = await supabase
    .from("books")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", bookId);

  if (!error) return;

  if (!error.message.includes("completed_at")) {
    console.error("[supabase] mark completed:", error.message, error.code);
  }

  await supabase.from("books").update({ status: "completed" }).eq("id", bookId);
}

/**
 * A row needs its cover resolved if it has no stored cover, or if the stored
 * one is a raw Google URL — those were written before resolution existed and
 * can be a placeholder or the wrong edition's art.
 */
function needsCoverResolution(book: Book): boolean {
  const stored = book.cover_url || book.thumbnail_url;
  return !stored || isGoogleBooks(stored);
}

// Once per book per session, so a book with no findable cover is not retried
// on every render.
const attempted = new Set<string>();

/**
 * Quietly upgrade any books still carrying an unresolved cover. Runs after a
 * page loads its books; nobody has to know it exists. New books are resolved
 * at add time and never come through here.
 *
 * Returns true if any row was updated, so the caller can refetch.
 */
export async function healUnresolvedCovers(books: Book[]): Promise<boolean> {
  const pending = books.filter((b) => !attempted.has(b.id) && needsCoverResolution(b));
  let changed = false;

  for (const book of pending) {
    attempted.add(book.id);
    const url = await resolveCoverUrl({
      google_books_id: book.google_books_id,
      isbn: book.isbn,
      title: book.title,
      author: book.author,
    });
    if (!url) continue;

    const { error } = await supabase
      .from("books")
      .update({ cover_url: url, thumbnail_url: url })
      .eq("id", book.id);
    if (!error) changed = true;
  }

  return changed;
}

/**
 * Keep book status in step with the calendar.
 *
 * The club reads whatever the next meeting is about, and that holds until the
 * meeting's date passes. Rather than asking anyone to flip a status by hand,
 * derive it: the next meeting's book is being read, and any book whose meeting
 * has already happened is finished.
 *
 * Returns true if anything changed, so the caller can refetch.
 */
export async function syncBookStatuses(): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];

  const [{ data: upcoming }, { data: past }, { data: books }] = await Promise.all([
    supabase
      .from("meetings")
      .select("book_id, date")
      .gte("date", today)
      .order("date", { ascending: true })
      .order("time", { ascending: true })
      .limit(1),
    supabase.from("meetings").select("book_id").lt("date", today),
    supabase.from("books").select("id, status, completed_at"),
  ]);

  const currentId = upcoming?.[0]?.book_id ?? null;
  const finishedIds = new Set(
    (past || []).map((m) => m.book_id).filter((id): id is string => Boolean(id))
  );
  finishedIds.delete(currentId ?? "");

  let changed = false;

  for (const b of (books || []) as { id: string; status: string; completed_at: string | null }[]) {
    if (b.id === currentId) {
      if (b.status !== "reading") {
        await supabase.from("books").update({ status: "reading" }).eq("id", b.id);
        changed = true;
      }
    } else if (finishedIds.has(b.id)) {
      if (b.status !== "completed") {
        await markCompleted(b.id);
        changed = true;
      }
    } else if (b.status === "reading") {
      // Was the current read, but no longer sits on any upcoming meeting.
      await markCompleted(b.id);
      changed = true;
    }
  }

  return changed;
}
