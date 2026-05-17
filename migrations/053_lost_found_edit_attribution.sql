-- Track who last filled in missing info on a lost & found item.
-- Both columns are nullable — items logged before this migration have no edit record.

ALTER TABLE lost_found
  ADD COLUMN IF NOT EXISTS edited_by_name TEXT,
  ADD COLUMN IF NOT EXISTS edited_at      TIMESTAMPTZ;
