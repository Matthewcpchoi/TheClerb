-- The Clerb — per-member reading status
--
-- The ledger on the Reading screen tracks where each member is with the
-- current book. That is status, not page numbers: the club does not keep
-- page counters. Run once in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS book_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  status text CHECK (status IN ('none', 'reading', 'finished', 'dnf')) DEFAULT 'none',
  updated_at timestamptz DEFAULT now(),
  UNIQUE (book_id, member_id)
);

ALTER TABLE book_progress ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'book_progress' AND policyname = 'Allow all on book_progress'
  ) THEN
    CREATE POLICY "Allow all on book_progress"
      ON book_progress FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
