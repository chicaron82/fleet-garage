-- The operator-curated list of rental-class chips (Aaron, 2026-07-24).
--
-- Setting a vehicle's class used to be a freeform text box in VehicleDirectEditModal — and because
-- a manual class edit LOCKS against future tag reads (the provenance ladder), a typo like "E66"
-- became permanent, locked, self-repair disabled. This table backs a tappable chip picker instead:
-- recognize-and-tap, not recall-and-type.
--
-- It is a LIST Aaron owns directly (personal tool — no management tier): "Other" inserts a row, a
-- long-press deletes one. Distinct from the `RentalClass` type union in src/data/manifest.ts, which
-- stays the curated vocabulary for demand-planning (substitutions, season priority). This table is
-- the OPERATIONAL list of "classes that exist in my fleet"; the two overlap in content, serve
-- different code. A vehicle's rental_class is still a free string — this only feeds the chips.
--
-- Seeded from src/lib/classOverrides.ts (ALL_RENTAL_CLASSES, in its "common -> specialty" order, +
-- CLASS_LABELS), plus a catch-all that pulls any class already on a fleet vehicle but not in that
-- curated list (e.g. Z4 — Volvos rejoined the fleet after the list was written). sort_order in
-- tens so a future insert can slot between; drift rows land at 999 for Aaron to reorder/relabel.
create table if not exists rental_classes (
  code       text primary key,
  label      text,
  sort_order integer not null default 999,
  created_at timestamptz not null default now()
);

-- Trusted-crew allow-all, matching vehicle_class_codex (migration 104).
alter table rental_classes enable row level security;
drop policy if exists rental_classes_all on rental_classes;
create policy rental_classes_all on rental_classes using (true) with check (true);

-- Curated seed (idempotent — re-running never clobbers an edited label/order).
insert into rental_classes (code, label, sort_order) values
  ('C',  'Compact',        10),
  ('F',  'Full Size',      20),
  ('B',  'Small Sedan',    30),
  ('B4', 'Small CUV',      40),
  ('B5', 'Std CUV',        50),
  ('D',  'Regular',        60),
  ('A',  'Economy',        70),
  ('Q4', 'SUV Compact',    80),
  ('L',  'SUV Std',        90),
  ('L2', 'SUV 7-seater',  100),
  ('T',  'Large SUV',     110),
  ('T4', 'Large SUV+',    120),
  ('T6', 'XL SUV',        130),
  ('E7', 'Tesla Std',     140),
  ('E8', 'Tesla AWD',     150),
  ('E9', 'Tesla Y',       160),
  ('E1', 'EV (Niro)',     170),
  ('E6', 'Hybrid',        180),
  ('R',  'Minivan',       190),
  ('S',  'Truck',         200),
  ('O6', 'Mid Truck',     210),
  ('A6', 'Mgr''s Special',220),
  ('Z4', 'Volvo',         230)
on conflict (code) do nothing;

-- Catch-all: any class already worn by a fleet vehicle that the curated seed missed. Lands at the
-- default sort_order (999) with no label for Aaron to name; keeps the chip list true to the fleet.
insert into rental_classes (code)
  select distinct upper(trim(rental_class)) from vehicles
  where rental_class is not null and trim(rental_class) <> ''
on conflict (code) do nothing;
