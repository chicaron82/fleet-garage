-- Migration 003: Actual hours tracking + peak season setting
-- Run manually in Supabase SQL editor (not committed — gitignored)

-- ── Shifts: actual hours + stat flag ─────────────────────────────────────────

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS actual_start_time TIME,
  ADD COLUMN IF NOT EXISTS actual_end_time   TIME,
  ADD COLUMN IF NOT EXISTS is_stat           BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Branch settings: peak season flag ────────────────────────────────────────
-- Single-row table (id = 1). Safe to run on fresh or existing DB.

CREATE TABLE IF NOT EXISTS branch_settings (
  id          INT PRIMARY KEY DEFAULT 1,
  peak_season BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Seed the row if it doesn't exist
INSERT INTO branch_settings (id, peak_season)
VALUES (1, false)
ON CONFLICT (id) DO NOTHING;
