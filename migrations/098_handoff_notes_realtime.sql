-- 098: Handoff live-sync. Add handoff_notes to the supabase_realtime publication so a shift handoff
-- logged on one device/tab pushes live to every other view (My Day's throughput glance, My Shift's
-- handoff banner) instead of only appearing after a reload. This closes the asymmetry where
-- shift_checkpoints had realtime (060) but handoff_notes did not — check-ins synced live, handoffs
-- didn't. The client subscribes to INSERT postgres_changes on this table and prepends-with-dedup-by-id
-- (WashbayContext), so the logger's own optimistic insert doesn't double up.
-- Idempotent: only add the table if it isn't already published.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'handoff_notes'
  ) then
    alter publication supabase_realtime add table public.handoff_notes;
  end if;
end $$;
