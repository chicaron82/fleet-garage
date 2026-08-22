-- WHERE the damage is, on the car.
--
-- A hold has carried WHAT (damage_description — a picklist: "Bumper damage — cosmetic") and WHAT IT
-- LOOKS LIKE (photos) since the beginning. It has never carried WHICH PANEL, except as prose in
-- `notes` that nothing can query: 101 of 441 holds already say it in Aaron's own words —
-- "Rear driver door ding", "Pass. Side Mirror missing cover", "Lift gate dents".
--
-- This column promotes those sentences into structure. Ids are the DAMAGE_ZONE_IDS in
-- src/lib/damageZones.ts and are stored verbatim: adding one is free, renaming one orphans every
-- hold already tagged with it.
--
-- Empty array, not null: "no zones recorded" and "zones recorded as none" are the same fact here,
-- and a NOT NULL default means no consumer ever has to think about it.

alter table public.holds
  add column if not exists damage_zones text[] not null default '{}'::text[];

comment on column public.holds.damage_zones is
  'Body panels this hold''s damage sits on — ids from src/lib/damageZones.ts (e.g. trunk-liftgate, driver-rear-door). The zone is an INDEX, not a measurement: the attached photo carries the precise spot and the damage type. Deliberately decoupled from photo capture so existing holds can be backfilled without the car present.';
