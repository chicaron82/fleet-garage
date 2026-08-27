-- FG's first US car (2026-08-27) — a Florida-plated Jeep Compass up from Fargo, whose dash reads
-- MILES and whose keytag names a plate the car is not wearing.
--
-- `is_us` drives three things: a 🇺🇸 badge on the record, the odometer surfaces reading miles instead
-- of km, and Aaron's own knowledge that it cannot be rented locally. He explicitly declined a louder
-- treatment for that last one — *"if we have time someone will get assignment to drive it back to
-- Fargo with someone following"* — so the flag stays a flag.
--
-- ⚠️ NO CONVERSION COLUMN, ON PURPOSE. Aaron: *"no conversion. but example for this it would show x
-- miles instead of x km."* The stored `odometer` is the number he typed off that dash and `is_us`
-- says which unit it is in. Converting on the way in would round-trip through km and hand back a
-- figure he never read — a small lie in the one field whose whole job is recording an observation.
alter table public.vehicles
  add column if not exists is_us boolean not null default false;

-- Winter tires are SEASONAL STATE, not a permanent fact — the same car is true in January and false
-- in July. So the observation carries its date, exactly like odometer/odometer_at and note/note_at.
--
-- ⚠️ THE DATE IS WHAT SEPARATES "no" FROM "nobody looked". A bare boolean cannot: an unticked box
-- means both, and a tick left over from February is silently wrong by the following winter — wrong
-- in the only season it matters. NULL here means never checked, which is the honest day-one state
-- for the entire fleet.
alter table public.vehicles
  add column if not exists winter_tires    boolean,
  add column if not exists winter_tires_at timestamptz;

comment on column public.vehicles.is_us is
  'US-plated vehicle: 🇺🇸 badge, odometer read in MILES, not rentable locally.';
comment on column public.vehicles.winter_tires is
  'Winter tires fitted, as last observed. NULL = never checked (not "no").';
comment on column public.vehicles.winter_tires_at is
  'When winter_tires was last observed. A value without this ages into a lie.';
