-- Phase 2: carry-over inheritance for morning throughput credit.
-- Morning crew often clears overnight backlog (cars fuelled a prior day, no fresh
-- gas line today) — without this field those cleans are invisible to the rate.
-- carry_over_cleared credits the inheriting shift for that work.

ALTER TABLE handoff_notes
  ADD COLUMN IF NOT EXISTS carry_over_cleared INTEGER NOT NULL DEFAULT 0;

-- RLS: permissive FOR ALL (matches existing handoff_notes policy pattern)
-- No new policy needed — existing permissive policy covers the new column.
