-- ──────────────────────────────────────────────────────────────────────────────
-- Fleet Garage — Supabase Setup
-- Run this entire file in the Supabase SQL Editor (one shot)
-- ──────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────

create table if not exists vehicles (
  id              text primary key,
  unit_number     text not null,
  license_plate   text not null,
  make            text not null,
  model           text not null,
  year            integer not null,
  color           text not null,
  status          text not null,
  created_at      timestamptz default now()
);

create table if not exists holds (
  id                  text primary key,
  vehicle_id          text not null references vehicles(id),
  damage_description  text not null,
  flagged_by_id       text not null,
  flagged_at          timestamptz not null,
  notes               text not null default '',
  photos              text[] not null default '{}',
  status              text not null,
  created_at          timestamptz default now()
);

create table if not exists releases (
  id              text primary key,
  hold_id         text not null references holds(id),
  approved_by_id  text not null,
  approved_at     timestamptz not null,
  reason          text not null,
  expected_return date not null,
  actual_return   date,
  notes           text not null default '',
  created_at      timestamptz default now()
);

-- ── Disable RLS (POC — anon key access) ──────────────────────────────────────

alter table vehicles disable row level security;
alter table holds    disable row level security;
alter table releases disable row level security;

-- ── Seed Data ────────────────────────────────────────────────────────────────

insert into vehicles (id, unit_number, license_plate, make, model, year, color, status) values
  ('v1', 'HRZ-4821', 'GHK 294', 'Toyota',    'Camry',    2022, 'Silver', 'HELD'),
  ('v2', 'HRZ-3307', 'JFT 881', 'Chevrolet', 'Malibu',   2023, 'White',  'OUT_ON_EXCEPTION'),
  ('v3', 'HRZ-5590', 'KLP 447', 'Ford',      'Escape',   2021, 'Black',  'RETURNED'),
  ('v5', 'HRZ-2298', 'PBX 773', 'Hyundai',   'Elantra',  2022, 'Red',    'HELD'),
  ('v7', '5513130',  'LJF684',  'Tesla',      'Model Y',  2022, 'Black',  'HELD');

insert into holds (id, vehicle_id, damage_description, flagged_by_id, flagged_at, notes, status) values
  ('h1', 'v1', 'Deep scratch on driver-side rear door. Paint chipped to metal. Approx 8 inches.',         'u1', '2026-04-05T14:22:00Z', 'Customer denied damage at return. Documented on lot before next rental.',                                    'ACTIVE'),
  ('h2', 'v2', 'Cracked windshield — passenger side. Spider crack from lower corner, approx 14 inches.', 'u3', '2026-03-28T09:10:00Z', 'Flagged before lot went to critical shortage. Repair appointment scheduled for Apr 12.',                   'RELEASED'),
  ('h3', 'v3', 'Front bumper damage — passenger side. Impact dent with cracked housing. Turn signal intact.', 'u2', '2026-03-10T16:05:00Z', 'Vehicle returned from 3-week rental. Damage not on pre-rental inspection sheet.',                    'RETURNED'),
  ('h4', 'v3', 'Interior — rear seat. Beverage stain, passenger side. Detailing could not fully remove.', 'u4', '2026-02-14T13:45:00Z', 'Customer returned late. Stain noticed during check-in. Photos taken.',                                   'RETURNED'),
  ('h5', 'v5', 'Missing driver-side mirror cap. Mirror glass intact. Clip housing broken.',               'u1', '2026-04-07T08:55:00Z', 'Noticed during lot walk. Not on last return inspection. Part ordered.',                                   'ACTIVE'),
  ('h6', 'v7', 'Dent — major / crumple',                                                                  'u3', '2025-11-14T10:20:00Z', 'Rear liftgate / bumper area. Impact dent, no paint break. Previously documented.',                        'RETURNED'),
  ('h7', 'v7', 'Dent — major / crumple',                                                                  'u1', '2026-04-08T11:30:00Z', 'Same rear liftgate dent. Pre-existing — has been on this vehicle for months. Flagging again for new staff awareness.', 'ACTIVE');

insert into releases (id, hold_id, approved_by_id, approved_at, reason, expected_return, actual_return, notes) values
  ('r1', 'h2', 'u6', '2026-03-29T11:45:00Z', 'Fleet shortage — critical rental demand. Windshield does not affect drivability. Customer informed and accepted.',  '2026-04-08', null,         'Customer signed exception waiver. Vehicle must return by Apr 8 for scheduled repair.'),
  ('r2', 'h3', 'u7', '2026-03-12T08:30:00Z', 'High-demand weekend. Bumper damage is cosmetic only. Customer accepted vehicle condition.',                          '2026-03-17', '2026-03-16', 'Returned one day early. Bumper replaced Mar 19.'),
  ('r3', 'h4', 'u6', '2026-02-15T10:20:00Z', 'Interior cosmetic issue only. Fleet shortage. Vehicle cleared for rental.',                                          '2026-02-18', '2026-02-19', 'Returned one day late. Seat professionally cleaned Feb 21.'),
  ('r4', 'h6', 'u6', '2025-11-15T09:00:00Z', 'Cosmetic only. Fleet at critical shortage. Customer accepted known damage.',                                         '2025-11-20', '2025-11-19', 'Customer signed exception waiver. Damage pre-dates current rental cycle.');

-- ── Storage bucket ───────────────────────────────────────────────────────────
-- After running this SQL, go to Storage in the Supabase dashboard and:
-- 1. Create a new bucket named: damage-photos
-- 2. Set it to Public
-- That's it.
