-- One row per branch per day: the fleet-health cohort counts as they stood (2026-08-17, Aaron's ask
-- while out on errands — *"how many were registered up x from yesterday, missing keytags, down x
-- from yesterday etc"*).
--
-- ⚠️ WHY A TABLE IS NEEDED AT ALL — the idea splits cleanly in half, and only one half needs this:
--
--   • "Registered, +28 today"  → NOT here. `vehicles.created_at` already holds the full history, so
--     registrations (and removals, via `archived_at`) are derivable retroactively, from day one, for
--     every day FG has existed. Nothing to build and nothing to wait for.
--
--   • "No keytag, down 5"      → needs this table. `keytag_photo_url`, `key_count`, make/model/year
--     are CURRENT-STATE columns with no timestamp. Nothing anywhere records the moment a car stopped
--     missing its keytag, so yesterday's cohort count is genuinely unknowable in hindsight. Same wall
--     as `vehicle_sightings` (114): going-forward only, and Aaron was told before the build.
--
-- WRITTEN CLIENT-SIDE, IDEMPOTENTLY, ON FIRST FLEET-MODULE OPEN OF THE DAY. No cron, no new infra —
-- FG's fire-and-forget house style. The trade is that a day he never opens the Fleet module has no
-- row, which is why the UI must label its ACTUAL comparison ("vs Aug 15") rather than assuming
-- "vs yesterday". A visible gap beats a confident lie; a delta is only as honest as its baseline.
--
-- Counts are stored, not the vehicle ids. The cohort definitions live in `fleetCohorts.ts` and may
-- be re-tuned; a stored count is a faithful record of "what the chip said that day" even if the
-- rule later changes, whereas a recomputed historical count would silently rewrite the past.
CREATE TABLE IF NOT EXISTS fleet_daily_snapshot (
  id                BIGSERIAL   PRIMARY KEY,
  branch_id         TEXT        NOT NULL,
  -- Local business date the counts describe (not the write time — see captured_at).
  snapshot_date     DATE        NOT NULL,
  total             INTEGER     NOT NULL,
  missing_keytag    INTEGER     NOT NULL,
  missing_keycount  INTEGER     NOT NULL,
  needs_backfill    INTEGER     NOT NULL,
  captured_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One row per branch per day. The writer UPSERTs on this, so re-opening the module later in the
  -- day refreshes the figures to the most recent look rather than stacking duplicate rows.
  UNIQUE (branch_id, snapshot_date)
);

-- The only query this serves: "the most recent snapshot BEFORE today, for this branch."
CREATE INDEX IF NOT EXISTS fleet_daily_snapshot_lookup_idx
  ON fleet_daily_snapshot (branch_id, snapshot_date DESC);

-- FG's standard posture: RLS on + allow-all (trusted-crew PoC). A table shipped without it deviates
-- from the rest AND trips Supabase's rls_disabled_in_public advisory (bit FG 2026-07-28, fixed by 110).
ALTER TABLE fleet_daily_snapshot ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fleet_daily_snapshot_all ON fleet_daily_snapshot;
CREATE POLICY fleet_daily_snapshot_all ON fleet_daily_snapshot FOR ALL TO public USING (true) WITH CHECK (true);
