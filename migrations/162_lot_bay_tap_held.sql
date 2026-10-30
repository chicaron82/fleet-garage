-- 162 — Lot Lookout, Erin St: a bay car that leaves on M hold or B hold takes one off the dirties, and says so.
--
-- Aaron, 2026-10-29, at the bay log with 0GK487 in: *"when i tap M hold/B hold would the clean count remain untouched
-- and the dirty count drop?"* Ruled "yes". Until now only a Clean exit moved a count. Ticket:
-- docs/ticket-bay-hold-exit-takes-a-dirty.md.
--
-- New kind, so the "Today" list says what moved the dirty instead of passing it off as a typed count:
--   held = a dirty taken off because the car left the bay on a hold (never onto the cleans)
-- Its Undo is logged as `undo`, like the quick taps'.
alter table public.lot_bay_taps drop constraint if exists lot_bay_taps_kind_check;
alter table public.lot_bay_taps add constraint lot_bay_taps_kind_check
  check (kind in ('ready', 'used', 'fix', 'dirties', 'set', 'drain', 'fill', 'undo', 'held'));
comment on table public.lot_bay_taps is
  'Lot Lookout, Erin St: every count change, for the bay page''s "Today" list. ready = +1, used = −1, fix = a −1 that undid a slip within 5 s, set = cleans typed (a correction), drain = cleans sent up with the drivers (used), fill = dirties brought back by the drivers, undo = a quick tap put back, held = a dirty off because a bay car left on M/B hold.';
