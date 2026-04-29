-- Migration: 005-shift-type-expand
-- Run in Supabase SQL Editor
-- Expands the shift_type CHECK constraint to include 'pto' and 'sick'.

ALTER TABLE shifts
  DROP CONSTRAINT IF EXISTS shifts_shift_type_check;

ALTER TABLE shifts
  ADD CONSTRAINT shifts_shift_type_check
    CHECK (shift_type IN ('opening', 'mid', 'closing', 'day-off', 'pto', 'sick'));
