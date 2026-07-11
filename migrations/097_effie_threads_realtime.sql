-- 097: Effie thread live-sync, Layer B (docs/ticket-effie-thread-live-sync.md). Add effie_threads to
-- the supabase_realtime publication so a change to a user's thread row on one OPEN device pushes to
-- another live. The client subscribes to postgres_changes on this table, filtered to its own
-- user_id row, and adopts-if-newer (the `at`-timestamp rule handles self-echo + mid-turn guarding).
-- Idempotent: only add the table if it isn't already published.
do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'effie_threads'
  ) then
    alter publication supabase_realtime add table public.effie_threads;
  end if;
end $$;
