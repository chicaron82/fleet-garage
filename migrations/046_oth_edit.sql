-- 046_oth_edit.sql
-- Edit + approval gate for off-standard time entries.
-- edit_status: null = no edit, 'pending' = awaiting approval, 'approved', 'denied'

ALTER TABLE off_standard_entries
  ADD COLUMN IF NOT EXISTS edited_end_time     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_requested_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_requested_by   TEXT,
  ADD COLUMN IF NOT EXISTS edit_status         TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS edit_reviewed_by    TEXT,
  ADD COLUMN IF NOT EXISTS edit_reviewed_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS edit_staff_note     TEXT;
