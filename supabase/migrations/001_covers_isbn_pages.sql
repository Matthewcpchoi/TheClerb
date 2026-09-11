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

-- Consolidate onto page_count, but only where total_pages actually exists.
-- Some deployments never had that column, and an unguarded UPDATE naming a
-- missing column aborts the whole transaction, rolling back the ALTERs above.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'books' AND column_name = 'total_pages'
  ) THEN
    EXECUTE '
      UPDATE books
         SET page_count = total_pages
       WHERE page_count IS NULL
         AND total_pages IS NOT NULL';
  END IF;
END $$;
