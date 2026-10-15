-- 152 — Lot Lookout: a stall can be TAKEN.
--
-- ⭐ THE ASK. Aaron, 2026-10-15, before the first driver trial: *"Tapping the stall itself would grey it out as
-- unavailable. Reason it's used up by a temporary customer or employee is parked there."* Until now a driver who
-- found a customer's car in a stall had no honest tap: clean and dirty are both wrong, and leaving it reads as
-- "nobody looked". A driver HOLDS the stall to mark it taken (his ruling: a hold, so a finger that lands on a
-- colour still works). Taken never fades (his ruling: "No fade"). Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.
--
-- Only the state check changes. lot_taps.state has no check, so the tap log takes 'taken' as it is.

alter table public.lot_stalls drop constraint lot_stalls_state_check;
alter table public.lot_stalls add constraint lot_stalls_state_check
  check (state in ('open', 'clean', 'dirty', 'taken'));
