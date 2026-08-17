-- "Last seen" — one row per key-tag SCAN (2026-08-16, Aaron's ask from the washbay floor).
--
-- His words: he scans everything with the header scanner — register if it's not on record, show
-- damage if it is, backfill blanks, log the keytag/key count. So the scan IS the sighting: he is
-- physically holding the car when it happens. "Last seen" = last scan = last activity in FG.
--
-- ⚠️ NOTHING recorded scans before this. The router routed and never logged, and `vehicle_checkins`
-- (which sounds right) has 0 rows, ever — built and abandoned, and the wrong shape anyway (a
-- check-in form with mileage/fuel/condition, not a sighting). So this is a GOING-FORWARD instrument;
-- there is no history to backfill and Aaron knows it. Retroactive proxies were checked and are too
-- thin to fake it: vsa_trips covers 54 of 575 active vehicles, and `vehicles` has no updated_at.
--
-- KEYED ON PLATE, not vehicle_id. A scan of an UNREGISTERED car has no vehicle row yet — he
-- registers it *after* the scan. Storing the plate means that first sighting still counts once the
-- car exists, so a freshly-registered vehicle shows the scan that created it. vehicle_id is filled
-- opportunistically when the scan resolved to a known car (handy for auditing, never the join key).
CREATE TABLE IF NOT EXISTS vehicle_sightings (
  id          BIGSERIAL PRIMARY KEY,
  seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The CORRECTED plate (post correctManitobaPrefix), so a mis-read tag still lands on the right car.
  plate       TEXT        NOT NULL,
  -- Resolved at scan time when the car was already on record; NULL for a not-yet-registered scan.
  vehicle_id  TEXT,
  seen_by_id   TEXT,
  seen_by_name TEXT,
  branch_id    TEXT
);

-- The only query this serves: "every sighting of this plate, newest first."
CREATE INDEX IF NOT EXISTS vehicle_sightings_plate_idx ON vehicle_sightings (plate, seen_at DESC);

-- FG's standard posture: RLS on + allow-all (trusted-crew PoC). A table shipped without it deviates
-- from the rest AND trips Supabase's rls_disabled_in_public advisory (bit FG 2026-07-28, fixed by 110).
ALTER TABLE vehicle_sightings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vehicle_sightings_all ON vehicle_sightings;
CREATE POLICY vehicle_sightings_all ON vehicle_sightings FOR ALL TO public USING (true) WITH CHECK (true);
