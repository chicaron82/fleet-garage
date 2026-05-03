-- Migration: 019-off-standard-entries
-- Run in Supabase SQL Editor
-- Persists VSA off-standard time entries so they survive navigation away from the module.
-- No RLS — permissions enforced client-side (VSA can only read their own; managers read all).

CREATE TABLE off_standard_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         TEXT        NOT NULL,
  branch_id       TEXT        NOT NULL DEFAULT 'YWG',
  date            DATE        NOT NULL,                         -- derived from start_time for fast day queries
  start_time      TIMESTAMPTZ NOT NULL,
  stop_time       TIMESTAMPTZ NOT NULL,
  minutes         INTEGER     NOT NULL CHECK (minutes >= 1),
  reason          TEXT        NOT NULL CHECK (reason IN ('CLASS', 'WFW', 'MTG', 'WTH', 'OTH')),
  explanation     TEXT,                                         -- optional free text
  auto_from_trip  BOOLEAN     NOT NULL DEFAULT false,          -- true = locked, came from movement log
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by user + date (today's entries for a VSA)
CREATE INDEX idx_ost_user_date ON off_standard_entries(user_id, date);

-- Fast lookups by branch + date (management view across team)
CREATE INDEX idx_ost_branch_date ON off_standard_entries(branch_id, date);
