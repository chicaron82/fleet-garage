-- 055_notifications_rls_fix.sql
-- Migration 008 created notifications policies scoped TO anon.
-- After the Keys to the Garage auth migration (054_profiles), the app runs as
-- the authenticated role — those anon-only policies block every pushNotification
-- call with a 403. Drop the role-scoped policies and replace with the codebase
-- pattern: FOR ALL USING (true) WITH CHECK (true), no TO clause.

DROP POLICY IF EXISTS "read"   ON notifications;
DROP POLICY IF EXISTS "insert" ON notifications;
DROP POLICY IF EXISTS "update" ON notifications;

CREATE POLICY "Allow all access" ON notifications
  FOR ALL USING (true) WITH CHECK (true);
