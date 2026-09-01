-- 134 — a third audit result: 'stale'.
--
-- ⚠️ 'unreadable' WAS DOING TWO JOBS, and they need opposite actions. Aaron, 2026-08-31, on the
-- Suburban whose tag photo was shot on its Alberta plate before it was re-plated in Manitoba:
-- *"i'd say just flag it for a retake the next time it comes in."* The only flag available was
-- 'unreadable' — which means *a human could not read this photo* — and that tag is perfectly
-- legible. Marking it unreadable would send the next person hunting for a blur that isn't there.
--
--   'unreadable' — I cannot read this photo        → a better photo of the SAME tag
--   'stale'      — I can read it, and it is wrong  → a photo of a DIFFERENT tag
--
-- ⭐ Both belong on the retake watchlist, because the action is the same gesture; the difference is
-- what he should EXPECT to see when he gets there, and that is worth a word.
alter table vehicles drop constraint if exists vehicles_keytag_audit_result_check;
alter table vehicles add constraint vehicles_keytag_audit_result_check
  check (keytag_audit_result is null
         or keytag_audit_result = any (array['verified'::text, 'unreadable'::text, 'stale'::text]));
