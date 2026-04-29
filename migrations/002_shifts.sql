-- Migration: 002-shifts
-- Run in Supabase SQL Editor
-- Creates the shifts table for the Schedule module.
-- No RLS — permissions enforced client-side via canEditShift().

CREATE TABLE shifts (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL,
  date       DATE        NOT NULL,
  start_time TIME,                    -- NULL for day-off shifts
  end_time   TIME,                    -- NULL for day-off shifts
  shift_type TEXT        NOT NULL CHECK (shift_type IN ('opening', 'mid', 'closing', 'day-off')),
  notes      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Fast lookups by user + date range (week/month queries)
CREATE INDEX idx_shifts_user_date ON shifts(user_id, date);

-- Fast lookups by date range across all users
CREATE INDEX idx_shifts_date ON shifts(date);
