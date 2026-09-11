-- The Clerb — member comments on books
--
-- Run once in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS book_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (book_id, member_id)
);

ALTER TABLE book_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE tablename = 'book_comments' AND policyname = 'Allow all on book_comments'
  ) THEN
    CREATE POLICY "Allow all on book_comments"
      ON book_comments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
