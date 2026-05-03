-- Create vsa_trips with full schema if it doesn't exist.
-- If it was already created manually, the ALTER TABLE ADD COLUMN IF NOT EXISTS
-- lines below will patch in any missing columns without touching existing data.

create table if not exists vsa_trips (
  id                  text primary key,
  vehicle_plate       text,
  vehicle_unit        text default '',
  trip_type           text,
  depart_location     text,
  arrive_location     text,
  depart_time         timestamptz,
  arrive_time         timestamptz,
  driver_id           text,
  branch_id           text,
  is_shuttle          boolean default false,
  notes               text,
  is_vsa_interruption boolean default false,
  auth_type           text,
  reason              text,
  queue_at_departure  text,
  fuel_on_arrival     text,
  condition           text,
  created_at          timestamptz default now()
);

-- Safe patches for tables that already exist with a partial schema
alter table vsa_trips add column if not exists vehicle_unit        text default '';
alter table vsa_trips add column if not exists branch_id           text;
alter table vsa_trips add column if not exists is_shuttle          boolean default false;
alter table vsa_trips add column if not exists notes               text;
alter table vsa_trips add column if not exists is_vsa_interruption boolean default false;
alter table vsa_trips add column if not exists auth_type           text;
alter table vsa_trips add column if not exists reason              text;
alter table vsa_trips add column if not exists queue_at_departure  text;
alter table vsa_trips add column if not exists fuel_on_arrival     text;
alter table vsa_trips add column if not exists condition           text;
alter table vsa_trips add column if not exists created_at          timestamptz default now();
