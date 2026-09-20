-- The Clerb — books the club is considering
--
-- Run once in the Supabase SQL editor. Idempotent.

CREATE TABLE IF NOT EXISTS nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  author text,
  cover_url text,
  isbn text,
  google_books_id text,
  synopsis text,
  genre text,
  added_by uuid REFERENCES members(id),
  created_at timestamptz DEFAULT now()
);

-- One row per member per nomination: whether they've read it already, and
-- whether they'd like the club to.
CREATE TABLE IF NOT EXISTS nomination_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nomination_id uuid REFERENCES nominations(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  has_read boolean DEFAULT false,
  interested boolean DEFAULT false,
  UNIQUE (nomination_id, member_id)
);

ALTER TABLE nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE nomination_reactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nominations'
                  AND policyname = 'Allow all on nominations') THEN
    CREATE POLICY "Allow all on nominations" ON nominations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'nomination_reactions'
                  AND policyname = 'Allow all on nomination_reactions') THEN
    CREATE POLICY "Allow all on nomination_reactions" ON nomination_reactions
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
