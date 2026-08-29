-- The key-tag auditor (docs/ticket-the-keytag-auditor.md) — Aaron reads the tags FG couldn't.
--
-- ⭐ WHY THIS EXISTS, and why it is not another backfill. All of 2026-08-27 I described FG's gaps —
-- 290 vehicles with no owning area, 155 with no VIN — as "the data is already in the stored photos,
-- so it is a re-read, so it costs API money and has to be sized and scheduled." Every one of those
-- sentences was true and every one assumed A MODEL had to do the reading. Aaron: *"where I could
-- add/edit verify info on the tag and cycle to the next on my spare time without burning API."*
-- A person reading the photo costs nothing, is more accurate than two models arguing over a smudge,
-- and fits the gaps he already has between cars.
--
-- ⚠️ THE STAMP IS WHAT MAKES THE QUEUE RESUMABLE. He will do four in a lull and walk away. Without a
-- per-car mark the queue re-serves the same cars forever and the pass never converges — which is the
-- one failure that would make this not worth opening.
alter table public.vehicles
  add column if not exists keytag_audited_at   timestamptz,
  add column if not exists keytag_audited_by   text,
  add column if not exists keytag_audit_result text;

-- ⭐⭐ THE RESULT COLUMN ABSORBS A WHOLE SECOND FEATURE. `ticket-tell-me-the-tag-photo-is-poor-
-- before-i-hold-it.md` wanted a `keytag_retake_watchlist` table keyed on vehicle_id: a list of cars
-- whose stored photo is cropped, blurred, or holds four tags at once, so a later scan can say "this
-- one needs a fresh shot." That list is exactly the set of cars he audits and cannot read.
--
-- So there is no second table. 'unreadable' IS the watchlist, written by the same tap that advances
-- the queue — and a retake later clears it back to NULL, putting the car back in line for its audit.
-- Auditing and flagging are one gesture; a separate table would have needed its own writer, its own
-- reader, and its own way of going stale against this column.
alter table public.vehicles drop constraint if exists vehicles_keytag_audit_result_check;
alter table public.vehicles add constraint vehicles_keytag_audit_result_check
  check (keytag_audit_result is null or keytag_audit_result in ('verified', 'unreadable'));

-- The retake list is a small slice of a large table, and it is read on every scan once the
-- scan-time notice ships. A partial index keeps that lookup off a 711-row sequential scan.
create index if not exists vehicles_keytag_unreadable_idx
  on public.vehicles (keytag_audit_result)
  where keytag_audit_result = 'unreadable';

comment on column public.vehicles.keytag_audited_at is
  'When a human last read this car''s stored key-tag photo. NULL = never audited (the queue).';
comment on column public.vehicles.keytag_audited_by is
  'Who audited it. FG is single-operator, but the write stamps its author like every other write.';
comment on column public.vehicles.keytag_audit_result is
  'verified = a person read the tag and the record now agrees with it. unreadable = the stored photo cannot be read and the car needs a fresh capture (this IS the retake watchlist). NULL = not yet audited.';
