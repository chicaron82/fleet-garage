-- Migration 066: Backfill hold attribution snapshots
--
-- Holds denormalize who flagged them (flagged_by_name, flagged_by_employee_id)
-- so the name still renders if that author's profile is ever deleted. But holds
-- created before those snapshots were written carry NULL/empty values, which
-- show as "Unknown" in exactly that deleted-profile case.
--
-- This fills the blanks from the current profiles table, by flagged_by_id.
-- COALESCE(NULLIF(...)) only touches empty/NULL fields, so it preserves any
-- existing snapshot and is safe to re-run (idempotent). Holds whose flagged_by_id
-- no longer matches a profile are left as-is — there's nothing to backfill from.
--
-- holds.flagged_by_id is text but profiles.id is uuid, so cast the uuid to text
-- (not the other way — flagged_by_id may hold legacy non-UUID ids that would
-- fail a ::uuid cast).

UPDATE holds h
SET flagged_by_name        = COALESCE(NULLIF(h.flagged_by_name, ''),        p.name),
    flagged_by_employee_id = COALESCE(NULLIF(h.flagged_by_employee_id, ''), p.employee_id)
FROM profiles p
WHERE h.flagged_by_id = p.id::text
  AND (
    h.flagged_by_name IS NULL OR h.flagged_by_name = ''
    OR h.flagged_by_employee_id IS NULL OR h.flagged_by_employee_id = ''
  );
