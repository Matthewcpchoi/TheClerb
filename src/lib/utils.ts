export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

function parsePageValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

/**
 * Page count is book metadata shown beside the author — never reading
 * progress. The club tracks progress as status, not page numbers.
 */
export function getExactPageCount(book: {
  page_count?: number | string | null;
  total_pages?: number | string | null;
}): number | null {
  return parsePageValue(book.page_count) ?? parsePageValue(book.total_pages);
}
