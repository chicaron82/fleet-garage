-- WATCH A PLATE — so a car FG has never seen still says HOLD when he scans it.
--
-- Aaron, 2026-08-26, off a whiteboard in the washbay ("OUT 86 / IN 85 / DFDA712 HOLD PLS. THX"):
-- "can I add a license plate to watch for? it doesn't exist in FG. so if I scanned it, it would
-- tell me to hold it."
--
-- The unseen-plate case IS the feature. A car FG knows has somewhere for a note to live -- flag a
-- hold on it. A car FG has never seen has nowhere at all, and an unknown car is the EASIEST one to
-- clean, stage and send straight back out, because nothing on any screen objects. So the moment a
-- watch is most needed is exactly the moment FG currently has the least to say. A hold cannot cover
-- it either: a hold needs a vehicle_id, which is what a stranger car does not have.
--
-- Keyed on the PLATE, normalized (upper, alphanumerics only) -- never on a vehicle id, or it could
-- not do the one job it exists for.
create table if not exists public.plate_watches (
  id          uuid primary key default gen_random_uuid(),
  branch_id   text not null default 'YWG',
  plate       text not null,
  -- His words, shown back to him verbatim at the scan. The board says "HOLD PLS. THX"; a dropdown
  -- of reason codes would lose exactly the thing that makes it actionable.
  reason      text not null default '',
  created_by  uuid,
  created_at  timestamptz not null default now(),
  -- CLEARED IS AN EVENT, NOT A DELETE -- same argument as holds.zones_reviewed_at (migration 125):
  -- a timestamp can be audited and undone, a missing row cannot say who acted or when.
  resolved_at timestamptz,
  resolved_by uuid
);

-- One LIVE watch per plate. Partial, so the history of past watches on the same car is kept.
create unique index if not exists plate_watches_live_plate_idx
  on public.plate_watches (branch_id, plate) where resolved_at is null;
create index if not exists plate_watches_plate_idx on public.plate_watches (plate);

-- FG standard posture: RLS enabled + allow-all (trusted-crew PoC). Posture alignment and advisory
-- silencing, NOT a lockdown -- the anon key is in the client.
alter table public.plate_watches enable row level security;
drop policy if exists plate_watches_all on public.plate_watches;
create policy plate_watches_all on public.plate_watches for all to public using (true) with check (true);

comment on table public.plate_watches is
  'Plates to stop on at scan time, including cars FG has no record of. Cleared by setting resolved_at, never deleted.';

-- The one he asked for. Ontario plate (AAAA999) on a car FG has no record of.
-- Plate CONFIRMED by Aaron off the board rather than read from the photo -- handwriting is not an
-- artifact to interpret, and a watch on the wrong plate is worse than no watch.
insert into public.plate_watches (plate, reason)
values ('DFDA712', 'HOLD PLS — off the washbay whiteboard (OUT 86 / IN 85)')
on conflict do nothing;
