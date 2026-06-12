-- Migration 077: per-issue resolution within a multi-type hold.
--
-- A hold flagged with several issues (e.g. hold_types = {damage, mechanical})
-- realistically gets them fixed at different times — the engine light before the
-- windshield. resolved_types records which of a hold's hold_types are cleared.
--
-- The hold's overall status flips to REPAIRED only once resolved_types covers
-- hold_types; until then it stays ACTIVE and keeps grounding the vehicle via the
-- existing status cascade (no derivation change — the cascade never reads this
-- column). Existing rows default to '{}' and behave exactly as today: resolving
-- the single (or final) issue marks the whole hold REPAIRED. Forward-only, no
-- historical recompute.

ALTER TABLE holds
  ADD COLUMN IF NOT EXISTS resolved_types text[] DEFAULT '{}'::text[] NOT NULL;
