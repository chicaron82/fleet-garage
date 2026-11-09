-- 167 — Lot Lookout's bay log: ✈ Sent up, and a finished line's exit changed after the fact.
--
-- Aaron, 2026-11-09: *"Editing a cleaned vehicle to M, B, or Erin afterwards"*, and of a clean that went straight back
-- up: *"FG doesn't need to know about an ASAP vehicle. Just that something we cleaned was sent up right away and marking
-- it as such"*. Ticket: docs/ticket-bay-sent-up-and-change-exit.md.
--
-- sent_up carries no time: one exit time per car stays the rule (no durations, 2026-10-29).
-- was_exit is the line's FIRST exit once it has been changed, so the list can say "was Clean"; null when unchanged.
--
-- Additive only: two columns on an existing table. No new table, so no new grants.
alter table public.lot_bay_log add column if not exists sent_up boolean not null default false;
alter table public.lot_bay_log add column if not exists was_exit text;

do $$ begin
  alter table public.lot_bay_log add constraint lot_bay_log_was_exit_check
    check (was_exit is null or was_exit in ('clean', 'mhold', 'bhold', 'skip', 'erin'));
exception when duplicate_object then null; end $$;

comment on column public.lot_bay_log.sent_up is
  'A Clean marked ✈ Sent up from the list: it went straight back up. No time of its own and moves no count. Written only by api/lot.ts (baySentUp, bayChangeExit, bayExitUndo).';
comment on column public.lot_bay_log.was_exit is
  'The first exit of a line whose exit was changed from the list (Change), so it reads "was Clean"; null when unchanged. Written only by api/lot.ts (bayChangeExit, bayExitUndo).';
