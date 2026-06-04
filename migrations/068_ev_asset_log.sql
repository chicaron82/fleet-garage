-- Migration 068: EV asset update log + last-updated attribution
--
-- A unified timeline of every EV-accessory observation, written from all four
-- sources (HIR check-in, driver trip, VSA washbay tab, management edit) so the
-- question "when did the cable/adapter go missing?" is one query. Motivating
-- case: an adapter gets borrowed from one Tesla to charge another and never
-- returned — the timeline shows it present on unit A, then missing, with unit B
-- gaining one at the same moment. The `notes` field carries "lent to unit B".
--
-- TEXT ids + permissive RLS to match holds / repairs / releases. hold_types is a
-- free text[] (no check constraint), so the new `missing_accessories` hold type
-- needs no DB change here.

create table if not exists ev_asset_updates (
  id              text        primary key,
  vehicle_id      text        not null references vehicles(id) on delete cascade,
  updated_by      text        not null,   -- user id, like holds.flagged_by_id
  source          text        not null,   -- check_in | driver_trip | vsa_washbay | management
  cable_status    text        check (cable_status   in ('present','missing')),
  adapter_status  text        check (adapter_status in ('present','missing')),
  notes           text,
  created_at      timestamptz not null default now()
);

alter table ev_asset_updates enable row level security;
create policy "Allow all access" on ev_asset_updates
  for all using (true) with check (true);

create index if not exists ev_asset_updates_vehicle_idx
  on ev_asset_updates (vehicle_id, created_at desc);

alter table vehicles
  add column if not exists ev_last_updated_by text,
  add column if not exists ev_last_updated_at timestamptz;
