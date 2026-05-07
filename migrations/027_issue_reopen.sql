-- Migration 027: Issue Log — search + reopen
-- Adds reopen tracking, status column, and event history table.

ALTER TABLE facility_issues
  ADD COLUMN IF NOT EXISTS reopen_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'reopened'));

-- Backfill: existing cleared issues → resolved
UPDATE facility_issues SET status = 'resolved' WHERE cleared_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS issue_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_id    UUID        NOT NULL REFERENCES facility_issues(id),
  event_type  TEXT        NOT NULL CHECK (event_type IN ('opened', 'resolved', 'reopened')),
  user_id     TEXT        NOT NULL,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issue_events_issue_id ON issue_events(issue_id);
