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
