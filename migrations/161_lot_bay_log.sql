-- 161 — Lot Lookout becomes the bay log: one car at a time through the Erin St bay, and how each one left.
--
-- ⭐ THE ASK. Aaron, 2026-10-29: *"Essentially the idea is showing what we cleaned. I'm already entering the odometer
-- and clean dirty count almost frequently. So a tap to mark as clean once finished"*. Riffed that night into the bay
-- log: *"look up vehicle, enter odo ... someone with the read-only link can see which vehicle we're currently cleaning.
-- ... once done, goes on the cleaned list. boss could see what we've done so far and when it was done"*. Ticket:
-- docs/ticket-lot-lookout-bay-log.md.
--
-- His rulings, all 2026-10-29:
--   • ONE car at a time: *"since it is just me using this, i can't start a new one when i'm still working on the
--     previous one"*. The partial unique index below is that rule, so two phones can never both start a car.
--   • Four exits: clean (onto the list, +1 Erin St cleans), mhold (Mechanical, PM due lives there), bhold (damage), and
--     skip: *"a vehicle in the queue needed to be done ASAP ... skip to do later"*. A restart of a skipped car points
--     back at it (`redo_of`), so the list can say "bumped, redone 10:55".
--   • *"cleans just go on a list. nothing gets removed"*.
--   • Durations, never: *"if it shows lol it might bite me later"*. started_at exists so the bay can say "since 11:20"
--     while the car is IN; every list shows exited_at only.
--
-- Same posture as 153: READ-ONLY to the browser's keys (the read-only /lot/view needs no PIN), written only by
-- api/lot.ts, and only for a signed-in FG session (never the PIN).

create table if not exists public.lot_bay_log (
  id          bigint      generated always as identity primary key,
  vehicle_id  text        not null,
  plate       text        not null,
  unit_number text,
  car         text,                               -- "2026 Toyota Corolla Cross · Gray", as the car was at Start
  odometer    int,                                -- the reading Start was made on
  started_at  timestamptz not null default now(),
  started_by  text,
  exit        text        check (exit in ('clean', 'mhold', 'bhold', 'skip')),   -- null = in the bay now
  exited_at   timestamptz,
  took_dirty  boolean     not null default false, -- a clean exit's +1 took a dirty (153's rule); its Undo gives it back
  redo_of     bigint      references public.lot_bay_log (id),
  shift_day   date        not null,               -- 04:00 Winnipeg cutover, like the rest of FG
  check ((exit is null) = (exited_at is null))
);
comment on table public.lot_bay_log is
  'Lot Lookout bay log: one row per car started in the Erin St bay, and its exit (clean / mhold / bhold / skip). One open row at a time. Written ONLY by api/lot.ts for a signed-in FG session. Aaron 2026-10-29.';

-- The one-car rule, in the database: at most one row with no exit.
create unique index if not exists lot_bay_log_one_in_bay on public.lot_bay_log ((true)) where exit is null;
create index if not exists lot_bay_log_day_idx on public.lot_bay_log (shift_day, started_at);

alter table public.lot_bay_log enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_bay_log' and policyname = 'lot_bay_log_read') then
    create policy lot_bay_log_read on public.lot_bay_log for select using (true);
  end if;
end $$;

-- Explicit grants (Supabase stops auto-granting new tables 2026-10-30; CLAUDE.md "A new table — four parts").
revoke insert, update, delete, truncate on public.lot_bay_log from anon, authenticated;
grant select on public.lot_bay_log to anon, authenticated;
grant all on public.lot_bay_log to service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_bay_log') then
    alter publication supabase_realtime add table public.lot_bay_log;
  end if;
end $$;
