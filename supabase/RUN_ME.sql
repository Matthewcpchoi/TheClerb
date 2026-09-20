-- The Clerb — run this once, in the Supabase SQL editor.
--
-- Every migration plus the club's score history, in order, in one file.
-- Safe to run more than once: every statement guards itself, members and
-- books match on name, and scores update rather than duplicate.
--
-- Paste the whole thing into a new query and press Run.



-- ════════════════════════════════════════════════════════════════════
-- 001_covers_isbn_pages.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- 002_unique_google_books_id.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- 003_book_comments.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- 004_book_progress.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- 005_meeting_host.sql
-- ════════════════════════════════════════════════════════════════════

-- The Clerb — who is hosting a meeting
--
-- The design shows "Mara's place · Parts Three & Four". The host is a club
-- member, so store the reference rather than re-typing a name into location.
-- Run once in the Supabase SQL editor. Idempotent.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES members(id);


-- ════════════════════════════════════════════════════════════════════
-- 006_quotes_and_orders.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- 007_admin_and_pages.sql
-- ════════════════════════════════════════════════════════════════════

-- The Clerb — admin, profile edits, and page numbers on questions
--
-- Run once in the Supabase SQL editor. Idempotent.

-- Adding and removing members, and switching whose profile is active, is the
-- club organiser's job rather than everyone's.
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_admin boolean DEFAULT false;

-- Seed the organiser. Safe to re-run; adjust the name if it differs.
UPDATE members SET is_admin = true WHERE lower(name) LIKE 'matthew%';

-- If nobody matched, the earliest member holds it so the club is never locked
-- out of its own settings.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM members WHERE is_admin) THEN
    UPDATE members SET is_admin = true
     WHERE id = (SELECT id FROM members ORDER BY created_at LIMIT 1);
  END IF;
END $$;

-- Questions carry a page, the same as quotes do.
ALTER TABLE discussion_topics ADD COLUMN IF NOT EXISTS page text;


-- ════════════════════════════════════════════════════════════════════
-- 008_nominations.sql
-- ════════════════════════════════════════════════════════════════════

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


-- ════════════════════════════════════════════════════════════════════
-- club_history.sql
-- ════════════════════════════════════════════════════════════════════

-- The Clerb — club history
--
-- Every score, amendment and aside from the club's first seven books.
-- Run once in the Supabase SQL editor. Safe to re-run: members and books are
-- matched by name, and scores are updated rather than duplicated.
--
-- Notation: a score written "7.75 > 8" is stored as pre_rating 7.75 and
-- post_rating 8 — the score going in, and the score after the club met.

-- ---------------------------------------------------------------- members

INSERT INTO members (name) VALUES
  ('Matthew'), ('Brooke'), ('Meg'), ('Charlie'), ('Lucy'), ('Becca'),
  ('Mia'), ('Morgan'), ('Lindsay'), ('Jack'), ('Tarek'), ('Francesca'),
  ('Cheryl'), ('Caroline'), ('Zach'), ('Sasha'), ('Ryan'), ('Evan')
ON CONFLICT (name) DO NOTHING;

UPDATE members SET is_admin = true WHERE name = 'Matthew';

-- ------------------------------------------------------------------ books
-- Titles match the rows already on the shelf so nothing is duplicated.
-- Authors are left null where the edition wasn't certain; cover resolution
-- falls back to a title search.

INSERT INTO books (title, author, status)
SELECT v.title, v.author, 'completed'
FROM (VALUES
  ('The Measure',           'Nikki Erlick'),
  ('None of This Is True',  'Lisa Jewell'),
  ('Recursion',             'Blake Crouch'),
  ('All the Sinners Bleed', 'S.A. Cosby'),
  ('Sky Daddy',             'Kate Folk'),
  ('Famesick',              NULL),
  ('Lost Lambs',            NULL),
  ('Red Notice',            NULL)
) AS v(title, author)
WHERE NOT EXISTS (SELECT 1 FROM books b WHERE b.title = v.title);

-- ---------------------------------------------------------------- scores

INSERT INTO ratings (book_id, member_id, pre_rating, post_rating, is_visible)
SELECT b.id, m.id, v.pre, v.post, true
FROM (VALUES
  -- The Measure · club average 7.52
  ('The Measure', 'Brooke',   8.0::numeric, NULL::numeric),
  ('The Measure', 'Meg',      8.0, NULL),
  ('The Measure', 'Charlie',  7.5, NULL),
  ('The Measure', 'Lucy',     7.5, NULL),
  ('The Measure', 'Matthew',  6.0, NULL),
  ('The Measure', 'Becca',    8.0, NULL),
  ('The Measure', 'Mia',      8.0, NULL),
  ('The Measure', 'Morgan',   6.0, NULL),
  ('The Measure', 'Lindsay',  7.7, NULL),
  ('The Measure', 'Jack',     8.5, NULL),

  -- None of This Is True · club average 7.19
  ('None of This Is True', 'Meg',       7.75, 8.0),
  ('None of This Is True', 'Mia',       7.75, 8.0),
  ('None of This Is True', 'Brooke',    6.0,  NULL),
  ('None of This Is True', 'Lindsay',   9.2,  NULL),
  ('None of This Is True', 'Charlie',   7.0,  NULL),
  ('None of This Is True', 'Matthew',   6.0,  NULL),
  ('None of This Is True', 'Lucy',      6.0,  NULL),
  ('None of This Is True', 'Francesca', 6.5,  NULL),
  ('None of This Is True', 'Morgan',    8.0,  NULL),

  -- Recursion · club average 7.94
  ('Recursion', 'Mia',     7.8, NULL),
  ('Recursion', 'Brooke',  8.0, NULL),
  ('Recursion', 'Charlie', 8.0, NULL),
  ('Recursion', 'Matthew', 7.9, NULL),
  ('Recursion', 'Lucy',    7.8, NULL),
  ('Recursion', 'Jack',    7.5, 7.8),
  ('Recursion', 'Becca',   8.3, NULL),

  -- All the Sinners Bleed · club average 6.32
  ('All the Sinners Bleed', 'Brooke',  6.5, NULL),
  ('All the Sinners Bleed', 'Charlie', 6.5, NULL),
  ('All the Sinners Bleed', 'Matthew', 6.2, NULL),
  ('All the Sinners Bleed', 'Lucy',    6.0, NULL),
  ('All the Sinners Bleed', 'Becca',   7.0, 6.5),
  ('All the Sinners Bleed', 'Cheryl',  7.0, 6.58),
  ('All the Sinners Bleed', 'Jack',    6.0, NULL),

  -- Sky Daddy · club average 4.58
  ('Sky Daddy', 'Becca',    3.5, NULL),
  ('Sky Daddy', 'Brooke',   4.6, 4.5),
  ('Sky Daddy', 'Caroline', 5.0, NULL),
  ('Sky Daddy', 'Charlie',  5.0, NULL),
  ('Sky Daddy', 'Lucy',     6.9, NULL),
  ('Sky Daddy', 'Matthew',  4.5, NULL),
  ('Sky Daddy', 'Meg',      2.0, 3.0),
  ('Sky Daddy', 'Morgan',   4.5, NULL),
  ('Sky Daddy', 'Zach',     5.2, NULL),

  -- Famesick · club average 5.94
  ('Famesick', 'Morgan',   4.0, NULL),
  ('Famesick', 'Brooke',   7.0, NULL),
  ('Famesick', 'Lucy',     7.0, NULL),
  ('Famesick', 'Matthew',  5.0, NULL),
  ('Famesick', 'Becca',    6.3, NULL),
  ('Famesick', 'Zach',     5.8, NULL),
  ('Famesick', 'Sasha',    7.8, 8.8),
  ('Famesick', 'Caroline', 7.1, NULL),
  ('Famesick', 'Ryan',     3.5, NULL),

  -- Lost Lambs
  ('Lost Lambs', 'Caroline', 7.2, NULL),
  ('Lost Lambs', 'Matthew',  7.6, 7.9),
  ('Lost Lambs', 'Zach',     9.1, NULL),
  ('Lost Lambs', 'Sasha',    7.7, 7.9),
  ('Lost Lambs', 'Lucy',     8.8, NULL),
  ('Lost Lambs', 'Becca',    8.0, 7.8),
  ('Lost Lambs', 'Brooke',   8.5, NULL),
  ('Lost Lambs', 'Charlie',  6.7, NULL),
  ('Lost Lambs', 'Meg',      7.5, NULL),
  ('Lost Lambs', 'Evan',     1.5, NULL)
) AS v(book, member, pre, post)
JOIN books   b ON b.title = v.book
JOIN members m ON m.name  = v.member
ON CONFLICT (book_id, member_id) DO UPDATE
  SET pre_rating  = EXCLUDED.pre_rating,
      post_rating = EXCLUDED.post_rating,
      is_visible  = true,
      updated_at  = now();

-- --------------------------------------------------------------- progress

INSERT INTO book_progress (book_id, member_id, status)
SELECT b.id, m.id, v.status
FROM (VALUES
  -- Read it but didn't put a number on it
  ('The Measure', 'Tarek',   'finished'),
  ('Sky Daddy',   'Lindsay', 'finished'),
  -- Didn't read, but turned up anyway
  ('All the Sinners Bleed', 'Meg', 'none'),
  -- Started and stopped
  ('Famesick', 'Charlie', 'dnf'),
  ('Famesick', 'Meg',     'reading')
) AS v(book, member, status)
JOIN books   b ON b.title = v.book
JOIN members m ON m.name  = v.member
ON CONFLICT (book_id, member_id) DO UPDATE SET status = EXCLUDED.status;

-- Anyone who put a number on a book has finished it.
INSERT INTO book_progress (book_id, member_id, status)
SELECT r.book_id, r.member_id, 'finished'
FROM ratings r
ON CONFLICT (book_id, member_id) DO NOTHING;

-- ---------------------------------------------------------------- asides
-- The remarks that came with each score.

INSERT INTO book_comments (book_id, member_id, content)
SELECT b.id, m.id, v.note
FROM (VALUES
  ('The Measure', 'Brooke',  'TBD on the box.'),
  ('The Measure', 'Meg',     'TBD on the box.'),
  ('The Measure', 'Charlie', 'Would open the box.'),
  ('The Measure', 'Lucy',    'Would open the box.'),
  ('The Measure', 'Matthew', 'Would open it eventually, after an immediate "no way".'),
  ('The Measure', 'Becca',   'Wouldn''t look at the box.'),
  ('The Measure', 'Mia',     'Wouldn''t look at the box — would be too on edge.'),
  ('The Measure', 'Morgan',  'When''s the alien going to come? Would open it — it''s on your doorstep, how can you not.'),
  ('The Measure', 'Lindsay', 'Would look, for the planning.'),
  ('The Measure', 'Tarek',   'Would if everyone does. Allocate time to the things you care about.'),

  ('None of This Is True', 'Brooke',    'Marked down for the ending.'),
  ('None of This Is True', 'Lucy',      'Marked down for the ending.'),
  ('None of This Is True', 'Francesca', 'Was motivated, but a psych thriller isn''t her vibe.'),
  ('None of This Is True', 'Morgan',    'Loves books like this.'),
  ('None of This Is True', 'Meg',       'Moved up to 8 in the clerb.'),
  ('None of This Is True', 'Mia',       'Moved up to 8 the morning after.'),

  ('All the Sinners Bleed', 'Meg', 'Did not read. Shame. Did attend.'),

  ('Sky Daddy', 'Lucy',    'Nice.'),
  ('Sky Daddy', 'Lindsay', 'Brought one human, grew another. Liked it more after the discussion.'),
  ('Sky Daddy', 'Meg',     'Came up from 2.0 after discussion.'),

  ('Famesick', 'Matthew', 'A 5 overall, but Lena is a 1.5.'),
  ('Famesick', 'Sasha',   'Amended up the next club — decided the first number was peer pressure.'),
  ('Famesick', 'Ryan',    'Somewhere between 3 and 4, based on about a tenth of it.'),
  ('Famesick', 'Charlie', 'DNF. Shame.'),
  ('Famesick', 'Meg',     'TBD.'),

  ('Lost Lambs', 'Matthew', 'Gnats. But pig Latin, minus a tenth.'),
  ('Lost Lambs', 'Sasha',   'Gnats.'),
  ('Lost Lambs', 'Zach',    'Tried to come down to 8.9 under peer pressure.'),
  ('Lost Lambs', 'Becca',   'Worse than The Measure.'),
  ('Lost Lambs', 'Evan',    'Hates that the good guy is Jewish.')
) AS v(book, member, note)
JOIN books   b ON b.title = v.book
JOIN members m ON m.name  = v.member
ON CONFLICT (book_id, member_id) DO UPDATE
  SET content = EXCLUDED.content, updated_at = now();

-- ------------------------------------------------------------------ lore

INSERT INTO discussion_topics (book_id, member_id, content, is_spoiler)
SELECT b.id, NULL, 'Lucy stole Zach''s copy by buying the last used one on Amazon.', false
FROM books b
WHERE b.title = 'Red Notice'
  AND NOT EXISTS (
    SELECT 1 FROM discussion_topics d
     WHERE d.book_id = b.id AND d.content LIKE 'Lucy stole%'
  );
