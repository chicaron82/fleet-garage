-- 143 — 'check-vehicle': the tag itself cannot answer, so stop asking the tag.
--
-- ⚠️ THE PROBLEM (Aaron, 2026-09-13, after the key-tag VIN transcription run). Of thirteen cars
-- carrying a tag photo but no VIN, five could never be transcribed — and only two of those were a
-- photo problem:
--
--   728NVJ, DEWN854  — HAND-WRITTEN replacement tags. There is no `Last9vin:` line on them at all.
--   LZM516, LZM539   — two FG rows whose tags BOTH print unit `542 7497` and VIN `0T3076384`.
--                      ⚠️ CORRECTED after this migration was applied (Aaron, same day): I had read
--                      these as ONE Prius, re-plated, and explained away the colour code differing
--                      (GRE vs GRA) as a tag regeneration. It was the opposite — that field was the
--                      one thing telling the two apart. *"they're two different vehicles with the
--                      same unit and VIN. that's why i wanted the flag on both."* TWO physical cars,
--                      and at least one wears a tag printed from the other's record. Which one is
--                      mis-tagged cannot be known from either tag, so BOTH are flagged.
--
-- ⭐ NONE OF THOSE IS A RETAKE. The photos are sharp, current, and belong to the car — 'unreadable'
-- would send him hunting for a blur that is not there, and 'stale' would tell him the tag in his
-- hand is the new one when it is the only one. A hundred fresh photos of DEWN854's handwritten tag
-- still have no VIN printed on them. The errand is not *photograph the tag again*; it is
-- **read the car** — the barcode sticker in the door jamb, which carries the full VIN.
--
-- ⚠️ SO IT IS A FOURTH WORD, not a reuse, for exactly the reason 'stale' was a third one
-- (migration 132): the two existing values differ only in what he should EXPECT to find, and both
-- resolve with a camera. This one resolves with a different SOURCE, so it belongs to a different
-- list. `retakeWatchlist` deliberately does not include it — putting it there would print the one
-- instruction guaranteed not to work.
--
-- ⭐ Same lifecycle as the other two: a fresh capture clears the result to NULL and re-queues the
-- audit. Reversible by a tap.

alter table vehicles drop constraint if exists vehicles_keytag_audit_result_check;
alter table vehicles add constraint vehicles_keytag_audit_result_check
  check (keytag_audit_result is null
     or keytag_audit_result = any (array['verified','unreadable','stale','check-vehicle']));

comment on column vehicles.keytag_audit_result is
  'Outcome of the key-tag audit. verified = a human checked the values against the photo. '
  'unreadable = the photo cannot be read; retake it. stale = legible but the wrong tag (re-plate); '
  'photograph the new one. check-vehicle = the tag is fine and still cannot answer (no VIN printed, '
  'or two records claim it) — read the barcode sticker on the car instead. NULL = not yet audited.';
