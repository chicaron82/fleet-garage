-- 045_rls_fix.sql
-- Fleet Garage uses the anon key with mock auth — no Supabase auth session.
-- Migration 044's "TO authenticated" policies and the extension's is_manager()-based
-- policies both block anon. Drop all of them; replace with the codebase pattern:
-- FOR ALL USING (true) WITH CHECK (true) — no TO clause = applies to all roles.

-- shifts
DROP POLICY IF EXISTS "Allow authenticated access" ON shifts;
DROP POLICY IF EXISTS shifts_delete ON shifts;
DROP POLICY IF EXISTS shifts_insert ON shifts;
DROP POLICY IF EXISTS shifts_select ON shifts;
DROP POLICY IF EXISTS shifts_update ON shifts;
CREATE POLICY "Allow all access" ON shifts FOR ALL USING (true) WITH CHECK (true);

-- off_standard_entries
DROP POLICY IF EXISTS "Allow authenticated access" ON off_standard_entries;
CREATE POLICY "Allow all access" ON off_standard_entries FOR ALL USING (true) WITH CHECK (true);

-- user_preferences
DROP POLICY IF EXISTS "Allow authenticated access" ON user_preferences;
DROP POLICY IF EXISTS user_preferences_delete ON user_preferences;
DROP POLICY IF EXISTS user_preferences_insert ON user_preferences;
DROP POLICY IF EXISTS user_preferences_select ON user_preferences;
DROP POLICY IF EXISTS user_preferences_update ON user_preferences;
CREATE POLICY "Allow all access" ON user_preferences FOR ALL USING (true) WITH CHECK (true);

-- user_pto
DROP POLICY IF EXISTS "Allow authenticated access" ON user_pto;
DROP POLICY IF EXISTS user_pto_delete ON user_pto;
DROP POLICY IF EXISTS user_pto_insert ON user_pto;
DROP POLICY IF EXISTS user_pto_select ON user_pto;
DROP POLICY IF EXISTS user_pto_update ON user_pto;
CREATE POLICY "Allow all access" ON user_pto FOR ALL USING (true) WITH CHECK (true);

-- handoff_notes
DROP POLICY IF EXISTS "Allow authenticated access" ON handoff_notes;
DROP POLICY IF EXISTS handoff_notes_delete ON handoff_notes;
DROP POLICY IF EXISTS handoff_notes_insert ON handoff_notes;
DROP POLICY IF EXISTS handoff_notes_select ON handoff_notes;
DROP POLICY IF EXISTS handoff_notes_update ON handoff_notes;
CREATE POLICY "Allow all access" ON handoff_notes FOR ALL USING (true) WITH CHECK (true);

-- whiteboard_notes
DROP POLICY IF EXISTS "Allow authenticated access" ON whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_delete ON whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_insert ON whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_select ON whiteboard_notes;
DROP POLICY IF EXISTS whiteboard_notes_update ON whiteboard_notes;
CREATE POLICY "Allow all access" ON whiteboard_notes FOR ALL USING (true) WITH CHECK (true);

-- facility_issues
DROP POLICY IF EXISTS facility_issues_delete ON facility_issues;
DROP POLICY IF EXISTS facility_issues_insert ON facility_issues;
DROP POLICY IF EXISTS facility_issues_select ON facility_issues;
DROP POLICY IF EXISTS facility_issues_update ON facility_issues;
CREATE POLICY "Allow all access" ON facility_issues FOR ALL USING (true) WITH CHECK (true);

-- issue_events
DROP POLICY IF EXISTS "Allow authenticated access" ON issue_events;
DROP POLICY IF EXISTS issue_events_insert ON issue_events;
DROP POLICY IF EXISTS issue_events_select ON issue_events;
CREATE POLICY "Allow all access" ON issue_events FOR ALL USING (true) WITH CHECK (true);

-- audits
DROP POLICY IF EXISTS "Allow authenticated access" ON audits;
DROP POLICY IF EXISTS audits_delete ON audits;
DROP POLICY IF EXISTS audits_insert ON audits;
DROP POLICY IF EXISTS audits_select ON audits;
DROP POLICY IF EXISTS audits_update ON audits;
CREATE POLICY "Allow all access" ON audits FOR ALL USING (true) WITH CHECK (true);

-- inventory_sessions
DROP POLICY IF EXISTS inventory_sessions_delete ON inventory_sessions;
DROP POLICY IF EXISTS inventory_sessions_insert ON inventory_sessions;
DROP POLICY IF EXISTS inventory_sessions_select ON inventory_sessions;
DROP POLICY IF EXISTS inventory_sessions_update ON inventory_sessions;
CREATE POLICY "Allow all access" ON inventory_sessions FOR ALL USING (true) WITH CHECK (true);

-- branch_settings
DROP POLICY IF EXISTS "Allow authenticated access" ON branch_settings;
DROP POLICY IF EXISTS branch_settings_insert ON branch_settings;
DROP POLICY IF EXISTS branch_settings_select ON branch_settings;
DROP POLICY IF EXISTS branch_settings_update ON branch_settings;
CREATE POLICY "Allow all access" ON branch_settings FOR ALL USING (true) WITH CHECK (true);
