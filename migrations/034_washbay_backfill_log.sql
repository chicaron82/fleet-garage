-- Migration 034: Washbay backfill log
-- Separate table for management to enter washbay data for past dates.
-- Entries in washbay_logs (from the closing form) always take precedence.

CREATE TABLE IF NOT EXISTS washbay_backfill_logs (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id            TEXT        NOT NULL,
  date                 DATE        NOT NULL,
  full_pages           INTEGER     NOT NULL DEFAULT 0,
  last_page_entries    INTEGER     NOT NULL DEFAULT 0,
  cars_remaining       INTEGER     NOT NULL DEFAULT 0,
  clean_not_picked_up  INTEGER     NOT NULL DEFAULT 0,
  team_size            INTEGER     NOT NULL DEFAULT 1,
  overtime_hours       INTEGER     NOT NULL DEFAULT 0,
  entered_by           TEXT        NOT NULL,
  entered_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(branch_id, date)
);

ALTER TABLE washbay_backfill_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read"   ON washbay_backfill_logs FOR SELECT TO anon USING (true);
CREATE POLICY "insert" ON washbay_backfill_logs FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "update" ON washbay_backfill_logs FOR UPDATE TO anon USING (true);
