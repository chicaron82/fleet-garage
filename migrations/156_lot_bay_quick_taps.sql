-- 156 — Lot Lookout, Erin St: the quick taps get their own lines in the bay's log.
--
-- Aaron, 2026-10-16, after a real shift with it: *"it's too complex to use fast and on the fly"*. His layout for the
-- count (the Erin pill's sheet): cleans and dirties both get −/+, a box to set, and a 0; cleans get DRAIN (minus the
-- drivers on now: *"tap the drain and removes 3 cleans off the count"*), dirties get FILL (*"the same 3 drivers arrive
-- back at the bay with dirties"*). Ticket: docs/ticket-lot-lookout-too-slow-on-the-fly.md.
--
-- New kinds, so the "Today" list says what happened instead of guessing from numbers:
--   set   = cleans typed to what is on the lot (a correction, never counted as used)
--   drain = cleans sent up with the drivers (counted as used)
--   fill  = dirties brought back by the drivers
--   undo  = a quick tap put back from its 5-second Undo
-- Dirties stepping ±1 or typed stays `dirties`.
alter table public.lot_bay_taps drop constraint if exists lot_bay_taps_kind_check;
alter table public.lot_bay_taps add constraint lot_bay_taps_kind_check
  check (kind in ('ready', 'used', 'fix', 'dirties', 'set', 'drain', 'fill', 'undo'));
comment on table public.lot_bay_taps is
  'Lot Lookout, Erin St: every count change, for the bay page''s "Today" list. ready = +1, used = −1, fix = a −1 that undid a slip within 5 s, set = cleans typed (a correction), drain = cleans sent up with the drivers (used), fill = dirties brought back by the drivers, undo = a quick tap put back.';
