-- Carry-over queue inherited from the previous shift.
-- Informational/contextual — does not affect the throughput calculation.
ALTER TABLE washbay_logs
  ADD COLUMN IF NOT EXISTS carry_over integer NOT NULL DEFAULT 0;

ALTER TABLE washbay_backfill_logs
  ADD COLUMN IF NOT EXISTS carry_over integer NOT NULL DEFAULT 0;
