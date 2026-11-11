-- 168: Odometer history, and a past gas sheet written to ITS day (2026-11-09,
-- docs/ticket-odometer-history-and-past-gas-sheet.md). Aaron: *"I select a date and whatever I enter would write to that
-- date"*, and *"would it take the older gas sheet and have it marked as the odo for saturday and keep the todays reading
-- as the current?"*.
--
-- Until now a car had ONE odometer (vehicles.odometer / odometer_at). This keeps every reading, dated by when it was
-- READ. vehicles.odometer stays the current: the newest by read date.
--
-- ⚠️ No Winnipeg date math here: FG's Postgres has old tz tables (Manitoba kept UTC−5 from 2026-11-01). The client
-- sends the sheet day's bounds as instants.

create table if not exists public.odometer_readings (
  id          bigserial primary key,
  vehicle_id  text not null references public.vehicles(id) on delete cascade,
  km          integer not null check (km > 0 and km < 10000000),
  read_at     timestamptz not null,
  source      text not null default 'app' check (source in ('app', 'gas_sheet', 'bay', 'backfill')),
  entered_at  timestamptz not null default now(),
  entered_by  text,
  voided_at   timestamptz,
  unique (vehicle_id, km, read_at)
);
comment on table public.odometer_readings is
  'Every odometer reading, dated by when it was READ (a past gas sheet carries its own day). vehicles.odometer is the newest live one. voided_at = a correction took it back.';
-- What a sheet row replaced when it became the car's current, so its Undo puts back exactly that (even an undated one).
alter table public.odometer_readings add column if not exists replaced_km integer;
alter table public.odometer_readings add column if not exists replaced_at timestamptz;
create index if not exists odometer_readings_vehicle_idx on public.odometer_readings (vehicle_id, read_at desc) where voided_at is null;

alter table public.odometer_readings enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'odometer_readings' and policyname = 'odometer_readings_all') then
    create policy odometer_readings_all on public.odometer_readings for all using (true) with check (true);
  end if;
end $$;
grant select, insert, update, delete on public.odometer_readings to anon, authenticated;
grant usage, select on sequence public.odometer_readings_id_seq to anon, authenticated;
grant all on public.odometer_readings to service_role;

-- ⭐ ONE TRIGGER SEES EVERY WRITER. The scan, the bay card, the flip, the record's own box and a desk fq.py all write
-- vehicles; none of them has to know this table exists.
--   • a new (odometer, odometer_at) pair is a reading (an equal number re-stamped is "reads the same": a reading too);
--   • a number that goes DOWN or is cleared is a correction (forward-only otherwise), so the reading it replaced is
--     voided, exactly that one.
create or replace function public.odometer_reading_log() returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.odometer is not null and old.odometer_at is not null
     and (new.odometer is null or new.odometer < old.odometer) then
    update public.odometer_readings set voided_at = now()
     where vehicle_id = new.id and km = old.odometer and read_at = old.odometer_at and voided_at is null;
  end if;
  if new.odometer is not null and new.odometer_at is not null
     and (tg_op = 'INSERT' or new.odometer is distinct from old.odometer or new.odometer_at is distinct from old.odometer_at) then
    insert into public.odometer_readings (vehicle_id, km, read_at, source, entered_by)
    values (new.id, new.odometer, new.odometer_at, 'app', nullif(current_setting('app.actor', true), ''))
    on conflict (vehicle_id, km, read_at) do update set voided_at = null;
  end if;
  return new;
end $$;

drop trigger if exists vehicles_odometer_reading on public.vehicles;
create trigger vehicles_odometer_reading after insert or update of odometer, odometer_at on public.vehicles
  for each row execute function public.odometer_reading_log();

-- ⭐ BACKFILL: what FG already knows. Every dated current reading, then the bay log's odos (today-only at a Start, or
-- read at the exit) that are not already there for that car.
insert into public.odometer_readings (vehicle_id, km, read_at, source)
select id, odometer, odometer_at, 'backfill' from public.vehicles
 where odometer is not null and odometer_at is not null and odometer > 0
on conflict (vehicle_id, km, read_at) do nothing;

insert into public.odometer_readings (vehicle_id, km, read_at, source)
select distinct on (l.vehicle_id, l.odometer) l.vehicle_id, l.odometer, coalesce(l.exited_at, l.started_at), 'bay'
  from public.lot_bay_log l
  join public.vehicles v on v.id = l.vehicle_id
 where l.odometer is not null and l.odometer > 0
   and not exists (select 1 from public.odometer_readings r where r.vehicle_id = l.vehicle_id and r.km = l.odometer)
 order by l.vehicle_id, l.odometer, coalesce(l.exited_at, l.started_at)
on conflict (vehicle_id, km, read_at) do nothing;

-- ⭐ A PAST GAS SHEET ROW. One transaction: the reading at the sheet's day, the visit (a sighting, his 2026-09-10
-- ruling: the gas line IS the record the car came through), and the car's current only when the sheet is the newest
-- by read date and not lower. A number that does not fit the car's history comes back as a conflict, written
-- nowhere, unless he says save it anyway (p_force).
create or replace function public.record_sheet_odometer(
  p_vehicle text, p_km integer, p_read_at timestamptz, p_day_start timestamptz, p_day_end timestamptz,
  p_by_id text, p_by_name text, p_branch text, p_force boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cur        record;
  before_r   record;
  after_r    record;
  rid        bigint;
  sid        bigint;
  is_current boolean := false;
begin
  if p_km is null or p_km <= 0 or p_km >= 10000000 then return jsonb_build_object('status', 'bad_km'); end if;
  if p_read_at < p_day_start or p_read_at >= p_day_end then return jsonb_build_object('status', 'bad_day'); end if;
  if p_day_start > now() then return jsonb_build_object('status', 'future'); end if;
  select id, license_plate, odometer, odometer_at into cur from public.vehicles where id = p_vehicle for update;
  if not found then return jsonb_build_object('status', 'no_car'); end if;

  if exists (select 1 from public.odometer_readings where vehicle_id = p_vehicle and km = p_km and voided_at is null
              and read_at >= p_day_start and read_at < p_day_end) then
    return jsonb_build_object('status', 'already');
  end if;

  select km, read_at into before_r from public.odometer_readings
   where vehicle_id = p_vehicle and voided_at is null and read_at < p_day_start order by read_at desc limit 1;
  select km, read_at into after_r from public.odometer_readings
   where vehicle_id = p_vehicle and voided_at is null and read_at >= p_day_end order by read_at asc limit 1;
  if not p_force and ((before_r.km is not null and p_km < before_r.km) or (after_r.km is not null and p_km > after_r.km)) then
    return jsonb_build_object('status', 'conflict',
      'before', case when before_r.km is null then null else jsonb_build_object('km', before_r.km, 'at', before_r.read_at) end,
      'after',  case when after_r.km  is null then null else jsonb_build_object('km', after_r.km,  'at', after_r.read_at) end);
  end if;

  insert into public.odometer_readings (vehicle_id, km, read_at, source, entered_by)
  values (p_vehicle, p_km, p_read_at, 'gas_sheet', p_by_name)
  on conflict (vehicle_id, km, read_at) do update set voided_at = null, source = 'gas_sheet', entered_by = excluded.entered_by
  returning id into rid;

  if not exists (select 1 from public.vehicle_sightings where vehicle_id = p_vehicle and seen_at >= p_day_start and seen_at < p_day_end) then
    insert into public.vehicle_sightings (seen_at, plate, vehicle_id, seen_by_id, seen_by_name, branch_id)
    values (p_read_at, cur.license_plate, p_vehicle, p_by_id, p_by_name, p_branch)
    returning id into sid;
  end if;

  -- `<=`, not `<`: a car twice on one sheet (both rows read at the day's noon) takes the higher second reading.
  if (cur.odometer_at is null or cur.odometer_at <= p_read_at) and (cur.odometer is null or cur.odometer <= p_km) then
    update public.odometer_readings set replaced_km = cur.odometer, replaced_at = cur.odometer_at where id = rid;
    update public.vehicles set odometer = p_km, odometer_at = p_read_at where id = p_vehicle;
    is_current := true;
  end if;

  return jsonb_build_object('status', 'saved', 'reading_id', rid, 'sighting_id', sid, 'current', is_current,
    'kept', case when is_current or cur.odometer is null then null
                 else jsonb_build_object('km', cur.odometer, 'at', cur.odometer_at) end);
end $$;

-- Its Undo: the row goes, its sighting goes, and if it is still the car's current, the current goes back to exactly
-- what it replaced.
create or replace function public.undo_sheet_odometer(p_reading bigint, p_sighting bigint default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  r record;
begin
  select * into r from public.odometer_readings where id = p_reading and source = 'gas_sheet' and voided_at is null;
  if not found then return jsonb_build_object('status', 'gone'); end if;
  delete from public.odometer_readings where id = p_reading;
  if p_sighting is not null then
    delete from public.vehicle_sightings where id = p_sighting and vehicle_id = r.vehicle_id;
  end if;
  -- Still the car's current: back to exactly what this row replaced (null when the car had none).
  if exists (select 1 from public.vehicles where id = r.vehicle_id and odometer = r.km and odometer_at = r.read_at) then
    update public.vehicles set odometer = r.replaced_km, odometer_at = r.replaced_at where id = r.vehicle_id;
  end if;
  return jsonb_build_object('status', 'undone');
end $$;

grant execute on function public.record_sheet_odometer(text, integer, timestamptz, timestamptz, timestamptz, text, text, text, boolean) to authenticated;
grant execute on function public.undo_sheet_odometer(bigint, bigint) to authenticated;
