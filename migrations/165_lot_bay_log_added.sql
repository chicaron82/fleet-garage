-- 165 — Lot Lookout's bay log: a car added to the list after the fact.
--
-- Aaron, 2026-11-05, on break with his partner cleaning solo: *"something to add his solo cleans to the list of what got
-- cleaned in my 30min off the floor"*, then *"just a way to add them in if needed is enough"*.
-- Ticket: docs/ticket-bay-add-a-car-cleaned.md.
--
-- An added row is a Clean stamped when he ADDS it, not when it was washed (nobody knows that minute), so the list says
-- "added later" beside its time. No name and no window: the bay's list, cars and times only.
--
-- Additive only: one column with a default. No new table, so no new grants.
alter table public.lot_bay_log add column if not exists added boolean not null default false;
comment on column public.lot_bay_log.added is
  'Added to the list after the fact (+ Add a car already cleaned), not started in the bay. Its time is when he added it, so the list says "added later". Written only by api/lot.ts (bayAdd).';
