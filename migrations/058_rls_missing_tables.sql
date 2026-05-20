-- 058_rls_missing_tables.sql
-- Two tables were created after the 044/045 RLS sweep and never had RLS enabled.
--
-- inventory_sessions (039): policies were added in 045 but ENABLE ROW LEVEL
--   SECURITY was never run — policies exist but have no effect without it.
--
-- shift_summaries (050): created after the sweep with no RLS or policies at all.

-- inventory_sessions — policy already exists from 045, just need the enable
ALTER TABLE inventory_sessions ENABLE ROW LEVEL SECURITY;

-- shift_summaries
ALTER TABLE shift_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access" ON shift_summaries
  FOR ALL USING (true) WITH CHECK (true);
