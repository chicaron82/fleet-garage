-- ── Fleet Garage: Repair Feature Migration ─────────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor

-- 1. Create the repairs table
CREATE TABLE IF NOT EXISTS repairs (
  id              TEXT        PRIMARY KEY,
  hold_id         TEXT        NOT NULL REFERENCES holds(id) ON DELETE CASCADE,
  repaired_by_id  TEXT        NOT NULL,
  repaired_at     TIMESTAMPTZ NOT NULL,
  notes           TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Enable Row Level Security (consistent with other tables)
ALTER TABLE repairs ENABLE ROW LEVEL SECURITY;

-- 3. Permissive policy for demo (same pattern as holds / releases)
CREATE POLICY "Allow all access" ON repairs
  FOR ALL USING (true) WITH CHECK (true);
