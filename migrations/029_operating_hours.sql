-- Migration 029: Operating Hours Rate Calculation
-- Adds overtime_hours to washbay_logs for extended operating day tracking.

ALTER TABLE washbay_logs
  ADD COLUMN IF NOT EXISTS overtime_hours INTEGER NOT NULL DEFAULT 0;
