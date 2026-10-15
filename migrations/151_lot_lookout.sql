-- 151 — Lot Lookout: a live stall board for the airport lot.
--
-- ⭐ THE ASK. Aaron, 2026-10-11: *"when dirties come in, they tap a stall that they park in. on my end i
-- would see how many dirties there are… so i would know if the airport is genuinely low on vehicles."*
-- Two days running (10-13, 10-14) the bay was pulled off cleaning because "the airport has no cleans"
-- while the clean side was full. Shaped over a mockup on 10-14; his go for the real thing the same night:
-- *"full build so i could test it live tomorrow"*. Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.
--
-- ⚠️⚠️ THE ONE DELIBERATE EXCEPTION TO FG'S ALLOW-ALL POSTURE. The lot page is opened by a driver with a
-- shared PIN, not an FG login (his ruling: *"separate page with a pin works"*, served at FG's /lot like
-- nanays' /request). So these three tables are READ-ONLY to anon/authenticated, and every write goes
-- through api/lot.ts, which checks the PIN and uses the service role. Without this, the PIN would be
-- decoration: FG's public key could write the board straight past it.
--
-- Stalls are the airport lot as it stands (1965 Wellington): P1–P20, O2–O20 (O1 is the cart return),
-- N3–N20 (N1–N2 are the HIR booth), S1–S6. 63 rows, seeded with state null = "nobody has looked".

create table if not exists public.lot_stalls (
  stall      text        primary key,
  run        text        not null check (run in ('S', 'P', 'O', 'N')),
  num        int         not null,
  state      text        check (state in ('open', 'clean', 'dirty')),
  tapped_by  text,
  tapped_at  timestamptz
);
comment on table public.lot_stalls is
  'Lot Lookout: one row per airport stall, its last tapped state. Written ONLY by api/lot.ts (PIN). Aaron 2026-10-11.';

create table if not exists public.lot_aisle (
  id         int         primary key default 1 check (id = 1),
  cars       int         not null default 0 check (cars >= 0),
  tapped_by  text,
  tapped_at  timestamptz
);
comment on table public.lot_aisle is
  'Lot Lookout: how many returns are left in the aisle (one row). Written ONLY by api/lot.ts (PIN).';

create table if not exists public.lot_taps (
  id          bigint      generated always as identity primary key,
  stall       text,                       -- null for an aisle change
  state       text,                       -- new state, or the new aisle count as text
  prev_state  text,
  tapped_by   text,
  tapped_at   timestamptz not null default now(),
  kind        text        not null check (kind in ('stall', 'aisle', 'undo'))
);
comment on table public.lot_taps is
  'Lot Lookout: every tap, for "will they keep tapping" (taps per day, week 1 vs week 3) and undo.';
create index if not exists lot_taps_at_idx on public.lot_taps (tapped_at desc);

-- Seed the stalls and the aisle row. Guarded, so a re-run changes nothing.
insert into public.lot_stalls (stall, run, num)
select r.run || n, r.run, n
from (values ('S', 1, 6), ('P', 1, 20), ('O', 2, 20), ('N', 3, 20)) as r(run, lo, hi),
     generate_series(r.lo, r.hi) as n
on conflict (stall) do nothing;
insert into public.lot_aisle (id) values (1) on conflict (id) do nothing;

-- RLS on, READ policy only. No insert/update/delete policy exists, so only the service role writes.
alter table public.lot_stalls enable row level security;
alter table public.lot_aisle  enable row level security;
alter table public.lot_taps   enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_stalls' and policyname = 'lot_stalls_read') then
    create policy lot_stalls_read on public.lot_stalls for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_aisle' and policyname = 'lot_aisle_read') then
    create policy lot_aisle_read on public.lot_aisle for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_taps' and policyname = 'lot_taps_read') then
    create policy lot_taps_read on public.lot_taps for select using (true);
  end if;
end $$;

-- Explicit grants (FG CLAUDE.md, "A new table — four parts"). ⚠️ Before 2026-10-30 Supabase auto-grants
-- ALL to anon on a new table, so the write privileges are REVOKED here, not merely not granted.
revoke insert, update, delete, truncate on public.lot_stalls, public.lot_aisle, public.lot_taps from anon, authenticated;
grant select on public.lot_stalls, public.lot_aisle, public.lot_taps to anon, authenticated;
grant all on public.lot_stalls, public.lot_aisle, public.lot_taps to service_role;

-- Live: a tap on one phone shows on every open screen.
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_stalls') then
    alter publication supabase_realtime add table public.lot_stalls;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_aisle') then
    alter publication supabase_realtime add table public.lot_aisle;
  end if;
end $$;
