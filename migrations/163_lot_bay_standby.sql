-- 163 — The bay log's Next up: the one car lined up behind the car in the bay, which every exit pulls in.
--
-- Aaron, 2026-11-02: *"since we generally work with another vehicle lined up. what if we entered standby plate for what is
-- going to cleaned next. tapping cleaned, starts the next one if one is loaded?"* His go: *"good to cook"*. Ticket:
-- docs/ticket-bay-odo-in-card-and-next-up.md.
--
--   • One slot, so the table holds at most one row (id = 1).
--   • On the server, not the phone: a hold closes from the Flag / hold screen, so the handoff has to happen where the exit
--     lands.
--   • shift_day, so a plate left loaded overnight never starts a car the next morning (the 04:00 cutover).
--   • lot_bay_log.pulled_by names the exit that pulled a row in, so that exit's Undo can rewind both cars. It is what lets
--     the one-car index (161) stay absolute: the next car comes back out before the first goes back in.
--
-- Same posture as 161: READ-ONLY to the browser's keys, written only by api/lot.ts for a signed-in FG session.
create table if not exists public.lot_bay_standby (
  id          int         primary key default 1 check (id = 1),
  vehicle_id  text        not null,
  plate       text        not null,
  unit_number text,
  car         text,
  loaded_at   timestamptz not null default now(),
  loaded_by   text,
  shift_day   date        not null
);
comment on table public.lot_bay_standby is
  'Lot Lookout bay log: the one car lined up next (Next up). Every exit from the bay pulls it in. Written ONLY by api/lot.ts for a signed-in FG session. Aaron 2026-11-02.';

alter table public.lot_bay_log add column if not exists pulled_by bigint references public.lot_bay_log (id);
comment on column public.lot_bay_log.pulled_by is 'The row whose exit pulled this car in off Next up. Null for a car started by hand.';

alter table public.lot_bay_standby enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_bay_standby' and policyname = 'lot_bay_standby_read') then
    create policy lot_bay_standby_read on public.lot_bay_standby for select using (true);
  end if;
end $$;

-- Explicit grants (Supabase stops auto-granting new tables 2026-10-30; CLAUDE.md "A new table — four parts").
revoke insert, update, delete, truncate on public.lot_bay_standby from anon, authenticated;
grant select on public.lot_bay_standby to anon, authenticated;
grant all on public.lot_bay_standby to service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_bay_standby') then
    alter publication supabase_realtime add table public.lot_bay_standby;
  end if;
end $$;
