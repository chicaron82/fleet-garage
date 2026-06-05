-- Migration 071: sent-to-fleet adjustments on the closing washbay log
--
-- The gas sheet counts cars *fuelled*, which the throughput/rate system reads as
-- cars *sent to fleet*. Those diverge two ways, the two ends of one deferred-prep
-- pipeline:
--   • non_rentables_fuelled — fuelled today (on the gas sheet) but parked, not
--     sent: damage-held units not in FG, or new units off the truck with no
--     plates/registration yet. Subtracted from sent-to-fleet (like cars_remaining
--     is, but for parked cars rather than the wash queue).
--   • deferred_completions — sent today but fuelled on a PRIOR day (no fresh gas
--     line today): a new unit gets its plates installed and goes up. Added to
--     sent-to-fleet.
-- A car lands in exactly one of cars_remaining / non_rentables_fuelled /
-- deferred_completions per day — never two at once.
--
-- non_rentables_note is the optional free-text reason (damage vs awaiting plates).
-- INTEGER + the existing anon RLS on washbay_logs — no policy change needed.

ALTER TABLE washbay_logs
  ADD COLUMN IF NOT EXISTS non_rentables_fuelled INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deferred_completions  INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_rentables_note     TEXT;
