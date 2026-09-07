-- 138 — "this tag really is this car's": a human overrule for a MISREAD plate.
--
-- ⚠️ THE PROBLEM (Aaron, 2026-09-07, mid key-audit). The re-read reported *"1 car has the wrong key
-- tag on file — XN294J, the stored tag reads XN294Z"*. The car is XN294J, the photo is XN294J's
-- tag, and the MODEL misread one character (J as Z).
--
-- `wrongPhotoCheck` compares the plate read off the tag with the record's plate and, on a
-- disagreement, VETOES: nothing is written and the mismatch is the finding. That design is right —
-- LUR243 is why it exists (a genuinely misfiled photo once wrote a 2026 VIN onto a 2025 Versa).
--
-- ⚠️⚠️ But it cannot tell a MISREAD from a MISFILE: one wrong character produces an identical
-- signal. With no way to record "I looked, the read is wrong", the warning re-fires on every future
-- re-read forever and that car's blanks are never filled. A state that exists and cannot be said.
--
-- ⭐ This column is the same claim the audit's `manual` stamp makes: A HUMAN LOOKED. Once set, the
-- re-read stops vetoing this car and writes normally — the veto exists to stop bad data, and
-- looking at it is precisely what removes that risk. Aaron's call: *"your rec on 1 is good with me."*
--
-- ⚠️⚠️ IT IS SCOPED TO THE PHOTO, NOT THE CAR — so a RETAKE MUST CLEAR IT (see keytagPhotoWrite).
-- A confirmation carried across a new photo would silence a genuine misfile on evidence nobody has
-- seen. Migration 130 made exactly this mistake in the other direction: its comment claimed a retake
-- cleared the audit stamp and the code did not, for months.
--
-- Reversible by design: setting both columns back to NULL un-confirms, so a wrong tap costs a tap.

alter table vehicles add column if not exists keytag_photo_confirmed_at timestamptz;
alter table vehicles add column if not exists keytag_photo_confirmed_by text;

comment on column vehicles.keytag_photo_confirmed_at is
  'When a human confirmed the stored key-tag photo really belongs to this car, overruling a plate '
  'mismatch from a misread. NULL = never confirmed. Cleared on retake: the claim is about THIS photo.';
comment on column vehicles.keytag_photo_confirmed_by is
  'Who confirmed it. Paired with keytag_photo_confirmed_at; both NULL when unconfirmed.';
