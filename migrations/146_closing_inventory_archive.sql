-- 146 — The closing inventory STOPS EVAPORATING. One row per car per close, kept.
--
-- ⭐⭐ Aaron, 2026-09-14, making the case himself: *"the inventory is also free data. with it
-- especially when we've been full and running a daily backlog we could see how long a clean has been
-- sitting at erin st. 3 days. appeared as a clean 3 days in row 3 on inventory. dirty sitting
-- un-cleaned for 2. damage sitting for x days still being recorded daily"*
--
-- ⚠️⚠️ WHAT THIS REPLACES. `closing_inventories` (137) is ONE ROW PER USER holding the live sheet,
-- stamped with the shift business day INSIDE the payload. A stale-day payload reads as nothing
-- (`useClosingInventory` line 102) and the next night's first save UPSERTS OVER IT. So every close
-- he has ever entered has been overwritten by the next one. Three nights were written this weekend
-- (2026-09-11/12/13) and only the last one can still be in that row. 137 stays exactly as it is —
-- it is the live working sheet and it is good at that. This is the archive beside it.
--
-- ⭐ WHY THE DATA IS WORTH KEEPING, in a way the hold table can never be. A hold is written when he
-- has a free hand — *"a table of flags measures when someone had time to flag, not how often the
-- thing happens"* (3fb721a's lesson; tire replacement shows ONE row and he says it is frequent). The
-- closing inventory is the opposite: it is an UNCONDITIONAL CENSUS. Every ring, every car, every
-- close, because the sheet is the job. So "seen as A in row 3 on the last 3 recorded closes" is real
-- evidence, and it answers things FG currently cannot:
--   · `washbay_logs.clean_not_picked_up` is a COUNT — this says WHICH cars, and for how long.
--   · a `B` car recorded nightly for two weeks is old-damage amnesia with a number on it.
--   · a `D` sitting two closes means the queue is not running FIFO.
--
-- ⚠️ GAPS ARE EXPECTED AND THAT IS FINE — his call, and he made it knowing exactly what it costs:
-- *"i know i don't close, and its not in my near future. but data is still data why not add it in
-- when its available. i know there will be gaps. its just me using it. i can't enter everything all
-- the time. i just happened to be able to enter closing the whole weekend on my days off"*
-- The ONE discipline this buys with a word instead of a feature: anything derived from these rows
-- counts RECORDED CLOSES, never days. "3 recorded closes" is true whatever happened in between;
-- "3 days" is the nine-day-hold lie (142) wearing a new hat.
--
-- ⚠️ NO UNIQUE ON (day, vehicle_id) — ON PURPOSE. `closingInventory.ts` already warns that the row
-- identity is not the plate because *"he can deliberately write the same car up twice"*. The sheet
-- row's own id is the key here too, so a deliberate double-entry survives the archive instead of
-- being silently collapsed into one.
--
-- ⭐ `seq` and `lot_row` are what keep the PAPER'S GRAMMAR. His Sept 1 sheet groups by ring — a blank
-- row is a group break, the row label is written once with a bracket dittoing down the group, and
-- *"each time a cleans ring was taken. its marked which row it came from"*, so the SAME row can
-- appear twice in one close. Ordering by `seq` reconstructs those pulls as separate groups; grouping
-- by status alone (which the counter's email does) flattens them.
--
-- RLS allow-all (FG trusted-crew/personal tool).
create table if not exists public.closing_inventory_entries (
  id           text        primary key,   -- the sheet row's own id, minted client-side
  day          date        not null,      -- the shift business day of the close (04:00 cutover)
  user_id      text        not null,
  vehicle_id   text        references vehicles(id) on delete set null,  -- null = typed in by hand
  plate        text        not null,
  unit_number  text,
  owning_area  text,
  rental_class text,
  status       text        not null check (status in ('A','D','B','M','F')),
  lot_row      text        not null default '',  -- only meaningful for A; stored bare ("5"), rendered "R-5"
  note         text        not null default '',
  seq          integer     not null default 0,   -- position on the sheet — preserves ring grouping
  recorded_at  timestamptz not null default now()
);

comment on table public.closing_inventory_entries is
  'Kept history of the closing inventory — one row per car per close. The live sheet is closing_inventories (137), which is per-user and overwritten nightly; this is the archive it feeds. Aaron 2026-09-14: "data is still data why not add it in when its available." GAPS ARE EXPECTED (he closes only when he happens to be there) — anything derived from these rows must count RECORDED CLOSES, never days.';
comment on column public.closing_inventory_entries.id is
  'The sheet row''s own id. NOT keyed on (day, vehicle) — he can deliberately write the same car up twice and that must survive.';
comment on column public.closing_inventory_entries.day is
  'Shift business day of the close (04:00 cutover), not the calendar date. Dwell = consecutive days PRESENT IN THIS TABLE, which is not the same as consecutive days.';
comment on column public.closing_inventory_entries.vehicle_id is
  'Null when the car was typed in by hand because FG had never met it. Kept null rather than dropped — the plate and unit are still the record.';
comment on column public.closing_inventory_entries.seq is
  'Position on the sheet. Preserves the ring grouping: the same lot_row can appear twice in one close because the ring was pulled twice.';

create index if not exists closing_inventory_entries_day_idx
  on public.closing_inventory_entries (day desc, seq);
create index if not exists closing_inventory_entries_vehicle_idx
  on public.closing_inventory_entries (vehicle_id, day desc);

alter table public.closing_inventory_entries enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'closing_inventory_entries'
      and policyname = 'closing_inventory_entries_all'
  ) then
    create policy closing_inventory_entries_all on public.closing_inventory_entries
      for all using (true) with check (true);
  end if;
end $$;
