-- 044_rls_coverage.sql
-- Enable RLS on the 10 tables that were missing it.
-- Pattern matches the rest of the codebase: blanket anon-compatible access.
-- Note: Fleet Garage uses the anon key with mock auth (no Supabase auth session),
-- so policies must omit the TO clause to cover all roles. Superseded by 045 which
-- also cleans up conflicting policies added by an external RLS tool.

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON shifts
  FOR ALL USING (true) WITH CHECK (true);

-- branch_settings
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON branch_settings
  FOR ALL USING (true) WITH CHECK (true);

-- user_pto
ALTER TABLE user_pto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON user_pto
  FOR ALL USING (true) WITH CHECK (true);

-- fleet_balance
ALTER TABLE fleet_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON fleet_balance
  FOR ALL USING (true) WITH CHECK (true);

-- handoff_notes
ALTER TABLE handoff_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON handoff_notes
  FOR ALL USING (true) WITH CHECK (true);

-- user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON user_preferences
  FOR ALL USING (true) WITH CHECK (true);

-- off_standard_entries
ALTER TABLE off_standard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON off_standard_entries
  FOR ALL USING (true) WITH CHECK (true);

-- audits
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON audits
  FOR ALL USING (true) WITH CHECK (true);

-- issue_events
ALTER TABLE issue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON issue_events
  FOR ALL USING (true) WITH CHECK (true);

-- whiteboard_notes
ALTER TABLE whiteboard_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON whiteboard_notes
  FOR ALL USING (true) WITH CHECK (true);
