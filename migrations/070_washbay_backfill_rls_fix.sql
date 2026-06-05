-- 070_washbay_backfill_rls_fix.sql
-- Migration 034 created washbay_backfill_logs policies targeting the `anon`
-- role only. Authenticated users (the actual writers) get 403 because the
-- `authenticated` role has no policy on this table.
-- Drop the narrow anon policies and replace with open role-agnostic ones.

DROP POLICY IF EXISTS "read"   ON washbay_backfill_logs;
DROP POLICY IF EXISTS "insert" ON washbay_backfill_logs;
DROP POLICY IF EXISTS "update" ON washbay_backfill_logs;

CREATE POLICY "Allow all access" ON washbay_backfill_logs
  FOR ALL USING (true) WITH CHECK (true);
