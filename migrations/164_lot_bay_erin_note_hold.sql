-- 164 — Lot Lookout's bay log: the Erin exit, a note on any row, and a row linked to the hold already on the car.
--
-- Aaron, 2026-11-04 (ticket: docs/ticket-bay-erin-exit-notes-existing-hold.md):
--   • *"I propose adding a fourth. Erin. Since cleaning them goes to their row to be rented at Erin St and not going up
--     for the airport"*. Ruled: it *"takes one off the dirties"*, and never +1 on the cleans (those are the airport's).
--   • *"on the cleaned list I could add notes to certain ones if needed"*. Ruled: they *"can be seen via the read-only link"*.
--   • *"For M and B, if it has an existing flag on it maybe having it available to select?"*, from the list's Flag it,
--     later: *"Keeping the same flow, going back to it later on the cleaned list"*.
--
-- Additive only: a wider exit check, two nullable columns, a wider tap-kind check. No new table, so no new grants.
alter table public.lot_bay_log drop constraint if exists lot_bay_log_exit_check;
alter table public.lot_bay_log add constraint lot_bay_log_exit_check
  check (exit in ('clean', 'mhold', 'bhold', 'skip', 'erin'));

alter table public.lot_bay_log add column if not exists note text;
alter table public.lot_bay_log drop constraint if exists lot_bay_log_note_check;
alter table public.lot_bay_log add constraint lot_bay_log_note_check check (note is null or char_length(note) between 1 and 140);
comment on column public.lot_bay_log.note is
  'His note on a finished row, shown on the list and the read-only /lot/view. Null = none. Written only by api/lot.ts (bayNote).';

alter table public.lot_bay_log add column if not exists hold_id text references public.holds (id) on delete set null;
comment on column public.lot_bay_log.hold_id is
  'An M / B row linked to the ACTIVE hold already on the car ("Same as the … hold" on the list''s Flag it). Set = flagged. api/lot.ts checks car, status and type.';

alter table public.lot_bay_taps drop constraint if exists lot_bay_taps_kind_check;
alter table public.lot_bay_taps add constraint lot_bay_taps_kind_check
  check (kind in ('ready', 'used', 'fix', 'dirties', 'set', 'drain', 'fill', 'undo', 'held', 'erin'));
comment on table public.lot_bay_taps is
  'Lot Lookout, Erin St: every count change, for the bay page''s "Today" list. ready = +1, used = −1, fix = a −1 that undid a slip within 5 s, set = cleans typed (a correction), drain = cleans sent up with the drivers (used), fill = dirties brought back by the drivers, undo = a quick tap put back, held = a dirty off because a bay car left on M/B hold, erin = a dirty off because a bay car was cleaned for Erin St''s own row (never onto the cleans).';
