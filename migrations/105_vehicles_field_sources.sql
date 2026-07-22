-- Per-field PROVENANCE for the key-tag identity fields — the fix for the rental-class fork
-- (docs/ticket-keytag-field-provenance.md, Aaron's design 2026-07-22).
--
-- ~156 live vehicles got their rental_class from DiZee INFERRING it off make/model (2026-07-21
-- backfill), not from a tag — and a guess was byte-identical to a real tag-read, so blanks-only
-- backfill could never correct it. This column records WHO last set each identity field, powering
-- a provenance ladder: inferred < tag < manual.
--
--   absent key   → inferred / unknown  → freely overwritten by a better source
--   'tag'        → read off a key tag  → overwrites inferred + older tag reads (with a ⚠️)
--   'manual'     → Aaron edited it      → LOCKED; no scan ever overrides it
--
-- No backfill of the 156 is needed: an ABSENT key already means "not locked, overwritable", so the
-- guesses self-heal on the next real scan. Keys are the KeytagField names (make/model/year/color/
-- rentalClass/unitNumber).
alter table vehicles
  add column if not exists field_sources jsonb not null default '{}'::jsonb;
