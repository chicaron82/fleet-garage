-- The CLASS CODE on the record (2026-08-19, Aaron: "how bout showing the code when I view/edit
-- details, not just on register").
--
-- The 4-char code on a key tag's class line ("CKSE", "CCVL") is what the codex resolves into a make
-- and model. FG has read it on every scan since the scanner shipped and **never stored it** — it
-- existed for the length of one request and evaporated. So a record whose make/model came from a
-- code could never be checked against the code that produced it.
--
-- ⚠️ WHY THAT MATTERS, from the same evening: a Seltos tag read CKSE as CKSP. Aaron corrected the
-- make and model on the register form, and FG taught the MISREAD code the right car. Nothing on the
-- vehicle recorded which code had been involved, so the only way to find it was to notice the
-- codex had grown a row. Storing it makes the provenance visible on the car itself.
--
-- IF-MISSING on write, like owning_area (migration 117) and for the same reason: a code doesn't
-- change over a car's life, so the FIRST good read should win and a later misread must never
-- overwrite it. A correction is a deliberate act — which is what the edit form is for — not a side
-- effect of any scan.
--
-- Nullable and NOT backfilled. Every car registered before today has no code on record, and a code
-- reverse-guessed from make+model would be a fabrication: several codes can share a model (trim
-- levels), so the mapping does not invert.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS class_code TEXT;

-- "Which cars came in under this code?" — the query that makes a bad codex entry traceable to the
-- vehicles it touched.
CREATE INDEX IF NOT EXISTS vehicles_class_code_idx ON vehicles (class_code) WHERE class_code IS NOT NULL;
