-- 057_holds_denorm_deprecated.sql
-- Retires the migration 056 workaround. Background: 056 added denormalized
-- `flagged_by_name` and `flagged_by_employee_id` columns because reads were
-- resolving attribution through the USERS mock (mock ids like 'u1'), which
-- never matched real Supabase auth UUIDs. Result: every hold rendered as
-- "Flagged by Unknown" in production.
--
-- The proper fix is to resolve attribution by joining `holds.flagged_by_id`
-- against the `profiles` table (created in migration 054). That work lands in
-- this PR: writes stop populating these columns, reads use a new
-- `useUserResolver` hook that joins live profiles and only falls back to the
-- denorm columns for historical rows where the profile no longer exists.
--
-- This migration:
--   1. Removes the NOT NULL constraint so new writes can omit the columns.
--   2. Adds a deprecation comment so anyone running `\d holds` sees the story.
--   3. Does NOT drop the columns yet — historical rows are still valid data,
--      and a future migration (058) can drop them once the resolver path is
--      proven in production.
ALTER TABLE holds ALTER COLUMN flagged_by_name        DROP NOT NULL;
ALTER TABLE holds ALTER COLUMN flagged_by_employee_id DROP NOT NULL;

ALTER TABLE holds ALTER COLUMN flagged_by_name        DROP DEFAULT;
ALTER TABLE holds ALTER COLUMN flagged_by_employee_id DROP DEFAULT;

COMMENT ON COLUMN holds.flagged_by_name
  IS 'DEPRECATED (migration 057). Snapshot of the flagger''s display name at hold-creation time. New writes omit this. Live reads join profiles via flagged_by_id; this is kept as a fallback for historical rows whose profile no longer exists.';

COMMENT ON COLUMN holds.flagged_by_employee_id
  IS 'DEPRECATED (migration 057). Snapshot of the flagger''s employee ID at hold-creation time. New writes omit this. Live reads join profiles via flagged_by_id; this is kept as a fallback for historical rows whose profile no longer exists.';
