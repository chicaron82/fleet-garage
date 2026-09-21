-- 148 — Recent look-ups: the last cars he found through 🔍 Find a car.
--
-- ⭐ THE ASK. Aaron, 2026-09-21, on the lot during a 150-out Monday, holding Find a car open on
-- MCN149: *"Whatcha think of adding a recent search history to the look up header? When I tap the
-- field it would show the last 3."* The field he reaches for with a car still in his head — look it
-- up, go do the thing, come back for the odometer or the counter flip — and every return trip meant
-- typing the plate again with gloves on.
--
-- ⭐ HIS CALLS, the same message thread:
--   1. Only a look-up that RESOLVED to a car is remembered. A typo never becomes a recent.
--   2. Remembering is not SEEING. A recent is a shortcut to a look-up, and a look-up has never been a
--      sighting ("typing something in just to look it up won't count as seen") — so this table sits
--      entirely outside `vehicle_sightings` and writes nothing there.
--   3. **In the database, not the phone** — *"Prefer migration."* So it follows him between devices,
--      same reason the closing inventory and airport flip sync (137).
--   4. Find a car ONLY. The shared VehicleLookup also runs the closing inventory and the airport flip,
--      where he walks the lot entering one new car after another and a recents list is noise.
--
-- ⭐ KEYED ON (user, car), NOT an append log. Looking the same car up again REFRESHES its stamp —
-- one upsert, and "the last 3" is simply the three newest rows. The table is bounded by the fleet
-- (one row per car he has ever looked up), so it needs no pruning.
--
-- user_id is the auth uid as text, the same identity `closing_inventories` (137) syncs under.

create table if not exists public.lookup_recents (
  user_id      text        not null,
  vehicle_id   text        not null references vehicles(id) on delete cascade,
  looked_up_at timestamptz not null default now(),
  primary key (user_id, vehicle_id)
);

comment on table public.lookup_recents is
  'The cars a user last found through Find a car — one row per (user, car), stamp refreshed on each look-up. Aaron 2026-09-21: "When I tap the field it would show the last 3." NOT a sighting: a look-up is not evidence he was at the car.';
comment on column public.lookup_recents.looked_up_at is
  'When he last looked this car up. Refreshed by upsert; the recents list is the newest three.';

create index if not exists lookup_recents_user_recent_idx
  on public.lookup_recents (user_id, looked_up_at desc);

-- FG's standard posture (trusted-crew PoC): RLS on + allow-all. Posture alignment and advisory
-- silencing, not a lockdown — see the RLS note on flagged_not_fixed / CLAUDE.md.
alter table public.lookup_recents enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'lookup_recents'
      and policyname = 'lookup_recents_all'
  ) then
    create policy lookup_recents_all on public.lookup_recents
      for all using (true) with check (true);
  end if;
end $$;
