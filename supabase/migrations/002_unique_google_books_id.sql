-- The Clerb — prevent duplicate books (optional, run separately)
--
-- Kept out of 001 on purpose: if the shelf already contains the same book
-- twice, this index fails, and in Supabase's SQL editor that failure would
-- roll back the column additions alongside it.
--
-- Check for duplicates first:
--
--   SELECT google_books_id, count(*), array_agg(title)
--     FROM books
--    WHERE google_books_id IS NOT NULL
--    GROUP BY google_books_id
--   HAVING count(*) > 1;
--
-- Delete the extras (keep the oldest of each), then run the index below.

CREATE UNIQUE INDEX IF NOT EXISTS books_google_books_id_key
    ON books (google_books_id)
 WHERE google_books_id IS NOT NULL;
