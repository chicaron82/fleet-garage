-- 153 — Lot Lookout: Erin St's count. Cleans ready for the airport, and dirties waiting.
--
-- ⭐ THE ASK. Aaron, 2026-10-15: *"What if we had an Erin St version of cleans available. Something boss lady can
-- see. Without the constant message. "What's the count?/How many clean and dirty?" Clean would be tapable for ones
-- ready to go to the airport. Dirty is an input field that gets updated once in a while"*. Shaped over a mock the
-- same morning; his go: *"Perfect. Let's cook it"*. Ticket: docs/ticket-erin-st-cleans-ready-count.md.
--
-- His rulings, all 2026-10-15:
--   • He taps −1 himself: *"The count would show that was the snapshot number was accurate at the timestamp"*. Both
--     numbers are snapshots, so each keeps its own time.
--   • −1 is "used", not "sent up": *"Erin St and the Regent location can poach cleans"*. `used` counts them for the
--     shift-day in `used_on` (04:00 Winnipeg cutover, like the rest of FG).
--
-- Same posture as 151: READ-ONLY to the browser's keys, written only by api/lot.ts behind the PIN. The read-only
-- page (/lot/view) needs no PIN because reading was already open; the PIN guards the buttons.
--
-- ⚠️ Its taps go in their OWN log, not lot_taps. lot_taps is the driver trial's measure ("taps per day, week 1 vs
-- week 3"); the bay's taps in there would read as drivers tapping.

create table if not exists public.lot_bay (
  id          int         primary key default 1 check (id = 1),
  cleans      int         not null default 0 check (cleans >= 0),
  cleans_by   text,
  cleans_at   timestamptz,
  dirties     int         check (dirties >= 0),   -- null = never counted
  dirties_by  text,
  dirties_at  timestamptz,
  used        int         not null default 0 check (used >= 0),
  used_on     date                                -- the shift-day `used` belongs to; another day reads as 0
);
comment on table public.lot_bay is
  'Lot Lookout, Erin St: cleans ready for the airport (tapped) and dirties waiting (typed), one row. Written ONLY by api/lot.ts (PIN). Aaron 2026-10-15.';

create table if not exists public.lot_bay_taps (
  id          bigint      generated always as identity primary key,
  kind        text        not null check (kind in ('ready', 'used', 'fix', 'dirties')),
  value       int         not null,               -- the count after the tap
  prev        int,                                -- the count before it
  tapped_by   text,
  tapped_at   timestamptz not null default now()
);
comment on table public.lot_bay_taps is
  'Lot Lookout, Erin St: every count change, for the bay page''s "Today" list. ready = +1, used = −1, fix = a −1 that undid a slip within 5 s.';
create index if not exists lot_bay_taps_at_idx on public.lot_bay_taps (tapped_at desc);

insert into public.lot_bay (id) values (1) on conflict (id) do nothing;

alter table public.lot_bay      enable row level security;
alter table public.lot_bay_taps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_bay' and policyname = 'lot_bay_read') then
    create policy lot_bay_read on public.lot_bay for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_bay_taps' and policyname = 'lot_bay_taps_read') then
    create policy lot_bay_taps_read on public.lot_bay_taps for select using (true);
  end if;
end $$;

revoke insert, update, delete, truncate on public.lot_bay, public.lot_bay_taps from anon, authenticated;
grant select on public.lot_bay, public.lot_bay_taps to anon, authenticated;
grant all on public.lot_bay, public.lot_bay_taps to service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_bay') then
    alter publication supabase_realtime add table public.lot_bay;
  end if;
end $$;
