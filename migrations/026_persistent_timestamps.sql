-- Migration 026: Persistent timestamp logging
-- Writes happen on Start tap, not on End. status='in_progress' is the sentinel.

-- off_standard_entries: add status, allow nulls on stop_time/minutes
ALTER TABLE off_standard_entries
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('in_progress', 'complete'));

ALTER TABLE off_standard_entries
  ALTER COLUMN stop_time DROP NOT NULL,
  ALTER COLUMN minutes   DROP NOT NULL;

-- vsa_trips: add status, allow null on arrive_time
ALTER TABLE vsa_trips
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('in_progress', 'complete'));

ALTER TABLE vsa_trips
  ALTER COLUMN arrive_time DROP NOT NULL;
