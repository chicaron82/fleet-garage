-- Make unit number nullable (can be unknown after registration)
ALTER TABLE vehicles ALTER COLUMN unit_number DROP NOT NULL;

-- Add vehicle edit suggestion columns
ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS edit_suggested_unit  TEXT,
  ADD COLUMN IF NOT EXISTS edit_suggested_plate TEXT,
  ADD COLUMN IF NOT EXISTS edit_suggested_by    TEXT,
  ADD COLUMN IF NOT EXISTS edit_suggested_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_suggestion_note TEXT,
  ADD COLUMN IF NOT EXISTS edit_status          TEXT DEFAULT NULL
    CHECK (edit_status IN ('pending', 'approved', 'denied')),
  ADD COLUMN IF NOT EXISTS edit_reviewed_by     TEXT,
  ADD COLUMN IF NOT EXISTS edit_reviewed_at     TIMESTAMPTZ;
