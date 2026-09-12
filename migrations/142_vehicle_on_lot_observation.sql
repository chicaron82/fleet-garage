-- Is this held car still on the lot? — a recorded OBSERVATION, never an inference.
--
-- ⭐ Aaron, 2026-09-12: *"what do you think of having a checkbox for damages FG holds. actual holds
-- being held, not ones that are out on exception. if it's present on the lot tick the box. else
-- unchecked its either been rented out between my shifts or sent to the bodyshop"*
--
-- ⚠️⚠️ WHY FG CANNOT DERIVE THIS. He is FG's only writer and writes when a car reaches him on shift,
-- so an ACTIVE hold means "the last time I saw it, it was held" — never "it has been held
-- continuously since". LUR527 is the worked example: hail-flagged 2026-09-02, then released for rent
-- with NO release logged (the counter releases cars; the counter does not use FG), driven 291 km, and
-- returned on the 8th. The only trace was the odometer jumping 11713 -> 12004 under an active hold.
-- A duration computed from `flagged_at` would have reported "held 9 days" about a car that spent part
-- of that week earning money.
--
-- ⚠️ TWO COLUMNS, NOT ONE, because he asked for the negative case to be recordable: *"if its gone one
-- day, then i uncheck the box."* A lone timestamp cannot distinguish "I checked and it was gone" from
-- "nobody has checked" — and that difference is the entire point. null = never looked.
--
-- ⚠️ On `vehicles`, not `holds`: the observation is about the CAR, and on a re-held car a hold-scoped
-- field would start blank and throw away the last known answer. The CONTROL stays scoped to
-- damage-held cars (exceptions excluded — an on-exception car is EXPECTED to be away, so presence is
-- not the question for it).
--
-- ⚠️ Whatever renders this must never say "gone" on a null or a false: unchecked means NOT CONFIRMED
-- SINCE <date>, and out-on-rent / at-the-bodyshop / not-yet-looked-at are indistinguishable here.
alter table vehicles
  add column if not exists on_lot_present    boolean,
  add column if not exists on_lot_checked_at timestamptz;

comment on column vehicles.on_lot_present is
  'What he last SAW: true = confirmed on the lot, false = looked and it was not there. Null = nobody has looked. Never infer absence from null or false.';
comment on column vehicles.on_lot_checked_at is
  'When that observation was made. Displayed as "checked the 10th" — a bare tick with no date rots into a false claim.';
