-- The Clerb — cover + page-count migration
--
-- Run this once in the Supabase SQL editor:
--   Supabase dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Safe to run more than once; every statement is idempotent.

-- Persisting the ISBN is what makes the Open Library cover fallback reachable
-- at render time. Without it, a book saved with a broken Google Books URL has
-- no second source and stays broken forever.
ALTER TABLE books ADD COLUMN IF NOT EXISTS isbn text;
CREATE INDEX IF NOT EXISTS books_isbn_idx ON books (isbn);

-- The app reads and writes these two; the original schema had neither.
ALTER TABLE books ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE books ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Consolidate the two page columns onto page_count.
UPDATE books
   SET page_count = total_pages
 WHERE page_count IS NULL
   AND total_pages IS NOT NULL;

-- Prevent the same book being added to the shelf twice.
CREATE UNIQUE INDEX IF NOT EXISTS books_google_books_id_key
    ON books (google_books_id)
 WHERE google_books_id IS NOT NULL;
