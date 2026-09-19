-- The Clerb — who is hosting a meeting
--
-- The design shows "Mara's place · Parts Three & Four". The host is a club
-- member, so store the reference rather than re-typing a name into location.
-- Run once in the Supabase SQL editor. Idempotent.

ALTER TABLE meetings ADD COLUMN IF NOT EXISTS host_id uuid REFERENCES members(id);
