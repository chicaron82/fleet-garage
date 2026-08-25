-- The last nine of the VIN, off the key tag (2026-08-25, Aaron: "start capturing the vin info from
-- keytags. then back fill that data from the keytags FG already has").
--
-- Every printed tag carries `Last9vin:` and FG has been reading straight past it since the scanner
-- shipped. It is the ONLY identifier on that tag that survives everything else changing.
--
-- WHY IT MATTERS — the re-plate. Aaron is converting low-km out-of-province cars to MB plates. On
-- conversion the unit number and owning area stay, and the PLATE — the key FG searches by — changes.
-- FG survives that today only via the unit-number fallback, and only while unit numbers stay unique
-- (659 distinct across 683 active cars as of today, but that is luck, not a constraint). A VIN makes
-- the identity certain instead of inferred:
--    plate    changes on conversion
--    class    changes when a car is re-classed
--    area     changes on transfer
--    unit#    stable, but not guaranteed unique and reissued after auction
--    VIN      never changes, for the life of the car
--
-- The 13-car conversion batch already on file (LJF670–689, contiguous plates on 2022 Teslas) is
-- what a conversion looks like AFTER the fact, with no record it happened. VIN is how the next one
-- is knowable rather than reconstructed.
--
-- ⚠️ NAMED `vin_last9`, NOT `vin`, AND THAT IS DELIBERATE. The tag prints nine characters, not
-- seventeen. A column called `vin` would invite exactly one thing: somebody — a future session, or
-- Effie with a decoder in her prompt — treating it as a full VIN and reading a manufacturer, plant
-- or check digit out of it. Those live in the FIRST eight characters, which this does not have. The
-- name is the guardrail.
--
-- ⭐ FIRST GOOD READ WINS, like class_code and unlike odometer. A VIN is immutable, so an early
-- reading is exactly as true as a late one and a later scan must never clobber it. The write only
-- ever fills a blank.
--
-- Not unique-constrained, on purpose. Nine characters is a serial + year + plant + check digit —
-- effectively unique within a manufacturer, but not guaranteed across the whole fleet, and a
-- misread must degrade to "two cars look alike" rather than a failed insert on a real car. It is a
-- CORROBORATING key, never a primary one.
--
-- Nullable and backfilled separately from the key-tag photos FG already stores (same machine as the
-- class-code backfill, which wrote 97 with zero disagreements). Absent means "not yet read".

ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS vin_last9 TEXT;

COMMENT ON COLUMN vehicles.vin_last9 IS
  'Last 9 characters of the VIN as printed on the key tag ("Last9vin:"). NOT a full VIN — the first 8 (WMI, attributes) are not on the tag. Immutable per car: first good read wins. A corroborating identity key, especially across a plate change; never a primary key.';

-- Lookup by VIN is a scan-time question ("is this car already on file under another plate?"),
-- so it wants an index. Partial: most rows are null until the backfill lands.
CREATE INDEX IF NOT EXISTS idx_vehicles_vin_last9
  ON vehicles (vin_last9)
  WHERE vin_last9 IS NOT NULL;
