create table if not exists vehicle_checkins (
  id                  uuid primary key default gen_random_uuid(),
  branch_id           text not null,
  vehicle_id          text,
  vehicle_unit        text not null,
  vehicle_plate       text not null,
  checked_in_by_id    text not null,
  checked_in_by_name  text not null,
  checked_in_at       timestamptz not null default now(),
  mileage             integer,
  fuel_level          integer,
  photo_count         integer not null default 0,
  interior_condition  text not null,
  exterior_condition  text not null,
  routing             text not null,
  condition_notes     text,
  notes               text
);

alter table vehicle_checkins enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'vehicle_checkins' and policyname = 'Allow all access') then
    create policy "Allow all access" on vehicle_checkins for all using (true) with check (true);
  end if;
end $$;
