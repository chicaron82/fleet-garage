-- 059_realtime_holds.sql
-- Enable Supabase Realtime for the holds table so the dashboard updates
-- live when any connected user flags or releases a hold.
--
-- Requires the table to be added to the supabase_realtime publication.
-- RLS is already enabled (via 017_core_tables / 044_rls_coverage) with
-- FOR ALL USING (true) — all authenticated users can receive events.

alter publication supabase_realtime add table holds;
