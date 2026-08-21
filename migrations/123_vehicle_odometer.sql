-- Keep the odometer the flip already collects (2026-08-20, Aaron: "its basically free data being
-- entered").
--
-- The airport flip captures odo on every return — he scans the tag, jots odo + fuel + damage — and
-- FG puts it in the counter copy-out and then **throws the number away.** Same shape as the class
-- code before migration 120: a value read on every pass, used once, discarded.
--
-- WHY IT MATTERS: the airport asks him *"do we have a high-km out-of-province car for a one-way?"*
-- He can answer the province half by eyeballing the lot or the key board — but the km half is
-- unanswerable while he's cleaning, and it is the half they lean on. It is also the input to YWG's
-- own export rule (~30,000 km, so the receiving branch won't want to keep it —
-- project_airport_flip_asset_retention).
--
-- ⚠️ THE DATE IS NOT OPTIONAL. A bare "47,200 km" ages into a lie — a reading from April describes a
-- car that has since done a summer of rentals. So `odometer_at` ships alongside, and every surface
-- must render them TOGETHER: "47,200 km as of Aug 12", never a naked number. A stale figure
-- presented as current is worse than no figure, because it invites a decision.
--
-- ⭐ LATEST WINS, unlike class_code's first-good-read-wins. The two are opposites for a reason: a
-- car's class code never changes, so an early reading is as true as a late one and a later scan
-- must not clobber it. An odometer ONLY moves forward, so the newest reading is always the best one
-- — and a lower number arriving later means a misread or the wrong car, not a fact.
--
-- Nullable, not backfilled: nothing in FG's history holds a past odo to recover. It fills in as he
-- flips cars, the same honesty as owning_area and class_code — absent means "not yet read".
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer    INTEGER;
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS odometer_at TIMESTAMPTZ;

-- The query it serves: "which of these could go out on a one-way?" — high km first.
CREATE INDEX IF NOT EXISTS vehicles_odometer_idx ON vehicles (odometer DESC) WHERE odometer IS NOT NULL;
