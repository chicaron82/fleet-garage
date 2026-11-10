-- 169 — Lot Lookout's bay log: ✈ Clean · sent up, an exit that takes the dirty and adds no clean.
--
-- Aaron, 2026-11-10: *"thoughts on having a "clean+sent" we're caught up so drivers take it once it's cleaned. Removes a
-- dirty and doesn't +1 the clean so I don't have to -1 when they take it"*. Ticket: docs/ticket-bay-clean-sent-up-at-exit.md.
--
-- sent_at_exit records that this Clean NEVER added to Erin St's cleans, so its Undo, Remove and Change take back only
-- what it moved (a dirty). sent_up stays the ✈ mark the list shows; a hand ✈ on a normal Clean still moves no count.
--
-- Additive: one column and two checks on existing tables. No new table, so no new grants.
alter table public.lot_bay_log add column if not exists sent_at_exit boolean not null default false;

do $$ begin
  alter table public.lot_bay_log add constraint lot_bay_log_sent_at_exit_check
    check (not sent_at_exit or exit = 'clean');
exception when duplicate_object then null; end $$;

comment on column public.lot_bay_log.sent_at_exit is
  'A Clean that left the bay as ✈ Clean · sent up: one dirty off, the cleans never moved. Undo, Remove and Change read it so they move only the dirty. Written only by api/lot.ts (bayExit, bayExitUndo, bayChangeExit).';

alter table public.lot_bay_taps drop constraint if exists lot_bay_taps_kind_check;
alter table public.lot_bay_taps add constraint lot_bay_taps_kind_check
  check (kind in ('ready', 'used', 'fix', 'dirties', 'set', 'drain', 'fill', 'undo', 'held', 'erin', 'sent'));
comment on table public.lot_bay_taps is
  'Lot Lookout, Erin St: every count change, for the bay page''s "Today" list. ready = +1, used = −1, fix = a −1 that undid a slip within 5 s, set = cleans typed (a correction), drain = cleans sent up with the drivers (used), fill = dirties brought back by the drivers, undo = a quick tap put back, held = a dirty off because a bay car left on M/B hold, erin = a dirty off because a bay car was cleaned for Erin St''s own row (never onto the cleans), sent = a dirty off because a bay car was cleaned and sent straight up (never onto the cleans).';
