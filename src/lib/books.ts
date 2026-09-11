import { supabase } from "@/lib/supabase";

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
