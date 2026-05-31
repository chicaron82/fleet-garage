-- Migration 067: Add pto_approved to shifts
--
-- PTO days start as a *request* (pto_approved = false) and become approved once
-- the boss signs off (the user flips them on the schedule). Lets the calendar
-- distinguish pending vs confirmed PTO, and the request export list only the
-- pending days. Non-PTO shifts ignore this flag.

ALTER TABLE shifts
  ADD COLUMN IF NOT EXISTS pto_approved BOOLEAN NOT NULL DEFAULT FALSE;
