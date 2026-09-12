-- Publish `vehicles` to realtime — making a subscription FG has carried for months actually work.
--
-- ⭐ Found while publishing `vsa_trips` (migration 140): `vehicles-realtime` in VehicleHoldContext
-- has subscribed to `vehicles` since it was written, and `vehicles` was never in the publication. A
-- Supabase channel on an unpublished table subscribes successfully and never fires — no error, no
-- warning — so the cross-client behaviour its comment carefully describes (a register, an archive,
-- an identity edit showing up for another user without a reload) has never once happened.
--
-- Aaron, 2026-09-11, told it was dead and that publishing the hot table was his call: *"let's do it,
-- while we're here."*
--
-- ⚠️ THE LOAD QUESTION, answered rather than waved off. `vehicles` is the table every scan and every
-- identity edit touches, so it is the busiest thing FG could publish. It is still fine here:
--   • FG is trusted-crew-only, so the fan-out is a handful of connected clients, not a public app.
--   • The handler refetches ONE ROW per event (`select … eq('id', …).single()`), not the fleet — so
--     a normal edit costs one small query per open client.
--   • The expensive shape is a BULK write: archiving nine exception cars fires nine events, and a
--     fleet-wide backfill would fire one per row per client. Nine is nothing; a 500-row backfill
--     would be a storm of single-row selects. If a backfill of that size is ever run against live
--     data, expect it — or drop the table from the publication for the duration:
--       alter publication supabase_realtime drop table vehicles;
--
-- Default replica identity (primary key) is enough: the handler reads only `payload.new.id` and
-- re-reads committed state, so it never depends on the old tuple.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vehicles'
  ) then
    alter publication supabase_realtime add table vehicles;
  end if;
end $$;
