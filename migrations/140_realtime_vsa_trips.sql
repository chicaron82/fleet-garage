-- Publish `vsa_trips` to realtime, so the My Day overflow card updates itself.
--
-- ⭐ Aaron, 2026-09-11, told the card only refreshes on open: *"I mean if it could have been done
-- lol why not. Saves navigating away and coming back or refreshing."* He logs a batch of sends from
-- the Movement Log; the card sits on My Day. Without this it shows the batch on his NEXT visit.
--
-- ⚠️⚠️ A SUPABASE CHANNEL ON AN UNPUBLISHED TABLE SUBSCRIBES SUCCESSFULLY AND NEVER FIRES. No error,
-- no warning, no failed promise — the hook reads correctly forever and simply never updates. Before
-- this migration the publication held exactly five tables (effie_threads, handoff_notes, holds,
-- notifications, shift_checkpoints), so the obvious client-side change alone would have been dead
-- code that passes review, passes the gate, and fails only in his hands.
--
-- ⚠️ AND FG ALREADY CARRIES ONE OF THOSE: `vehicles-realtime` (VehicleHoldContext) subscribes to
-- `vehicles`, which is not published — so the cross-client vehicle updates its comment describes
-- have never arrived live. Deliberately NOT fixed here: `vehicles` is the hot table (every scan and
-- every identity edit touches it), so publishing it is a load decision of its own and deserves an
-- explicit call, not a ride-along on this one.
--
-- Default replica identity (primary key) is enough: the card uses the event only as a signal and
-- refetches through the shared manifest rules, so it never reads the payload's old row.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vsa_trips'
  ) then
    alter publication supabase_realtime add table vsa_trips;
  end if;
end $$;
