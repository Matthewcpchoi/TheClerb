-- The Clerb — quotes, and group food orders for a meeting
--
-- Run once in the Supabase SQL editor. Idempotent.

-- Favourite lines from a book, kept alongside reviews and questions.
CREATE TABLE IF NOT EXISTS book_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid REFERENCES books(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  content text NOT NULL,
  page text,
  created_at timestamptz DEFAULT now()
);

-- What each member wants when the club orders food for a meeting.
CREATE TABLE IF NOT EXISTS meeting_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid REFERENCES meetings(id) ON DELETE CASCADE,
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  item text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE (meeting_id, member_id)
);

-- The shared basket link somebody pastes in once they've started the order.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS order_url text;

ALTER TABLE book_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_orders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'book_quotes'
                  AND policyname = 'Allow all on book_quotes') THEN
    CREATE POLICY "Allow all on book_quotes" ON book_quotes FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meeting_orders'
                  AND policyname = 'Allow all on meeting_orders') THEN
    CREATE POLICY "Allow all on meeting_orders" ON meeting_orders FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
