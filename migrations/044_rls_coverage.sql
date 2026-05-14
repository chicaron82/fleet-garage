-- 044_rls_coverage.sql
-- Enable RLS on the 10 tables that were missing it.
-- Pattern matches the rest of the codebase: blanket authenticated access.

-- shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON shifts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- branch_settings
ALTER TABLE branch_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON branch_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_pto
ALTER TABLE user_pto ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON user_pto
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- fleet_balance
ALTER TABLE fleet_balance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON fleet_balance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- handoff_notes
ALTER TABLE handoff_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON handoff_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- user_preferences
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON user_preferences
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- off_standard_entries
ALTER TABLE off_standard_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON off_standard_entries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- audits
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON audits
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- issue_events
ALTER TABLE issue_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON issue_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- whiteboard_notes
ALTER TABLE whiteboard_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON whiteboard_notes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
