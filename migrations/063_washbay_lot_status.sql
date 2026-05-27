-- Migration 063: Add lot_status to washbay_logs
-- Closing crew now records lot status when submitting the end-of-day washbay log.

ALTER TABLE washbay_logs
  ADD COLUMN IF NOT EXISTS lot_status TEXT NOT NULL DEFAULT 'manageable'
    CHECK (lot_status IN ('zeroed', 'manageable', 'backlog'));
