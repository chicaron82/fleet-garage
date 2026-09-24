-- 149 — A photo per reopen: each fault on a machine keeps its own picture.
--
-- ⭐ THE ASK. Aaron, 2026-09-24, after the auto wash's rinse pipe snapped off the arch:
-- *"I reopened it. But couldn't explain what broke or attach a new photo of it in the issue log."*
-- The note half shipped in 27ce343. This is the photo half, and his go: *"green for both"*.
--
-- ⚠️ WHY A COLUMN ON THE EVENT, NOT A SECOND photo_url ON THE ISSUE. The Issue Log already models the
-- machine as the record and the fault as what's true TODAY (lib/currentFault, 2026-09-20): the
-- current fault is DERIVED from the newest reopen note, and `description` is never overwritten so the
-- first fault survives. A photo is evidence OF a fault, so it belongs beside that fault's note — and
-- `facility_issues.photo_url` stays the FIRST fault's picture, untouched, exactly like `description`.
-- Overwriting it would erase June's E-stop photo to show September's pipe.
--
-- ⚠️ Adds a column to an EXISTING table, so the 2026-10-30 explicit-GRANT rule does not apply —
-- issue_events keeps the grants and the allow-all RLS policy it already has.
--
-- Nullable, no default: every event before this has no photo, and "no photo" is honest for them.

alter table public.issue_events
  add column if not exists photo_url text;

comment on column public.issue_events.photo_url is
  'A photo of THIS event''s fault (reopens). The issue''s own photo_url stays the first fault''s picture. Aaron 2026-09-24: "couldn''t ... attach a new photo of it in the issue log."';
