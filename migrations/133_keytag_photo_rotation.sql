-- 133 — a quarter-turn for a sideways key tag.
--
-- Aaron, auditing the batch that landed this morning: *"some are shown on its side is there a way to
-- rotate them here in the audit, and the saved photo as well?"* LFJ368's tag sits at ~30°, LFJ400's
-- was fully sideways — and DiZee had to crop and rotate that one in PIL just to settle a VIN.
--
-- ⭐ THE ANGLE IS STORED, THE FILE IS NOT TOUCHED. Re-encoding the photo to "fix" it would be
-- destructive and irreversible on an image whose entire job is being legible enough to read a VIN
-- off — a JPEG round-trip costs exactly the detail that matters. A wrong rotation is then one more
-- tap instead of a re-upload, and the captured file stays exactly as the camera produced it.
--
-- ⚠️ The cost is that every render site must honour it. Three do today (KeytagAuditCard,
-- VehicleRecordFacts, VehicleHistory) and they share one helper; re-check this if the tag photo
-- ever gains a fourth home.

alter table public.vehicles
  add column if not exists keytag_photo_rotation smallint not null default 0;

alter table public.vehicles
  drop constraint if exists vehicles_keytag_rotation_quarter_turns;

alter table public.vehicles
  add constraint vehicles_keytag_rotation_quarter_turns
  check (keytag_photo_rotation in (0, 90, 180, 270));

comment on column public.vehicles.keytag_photo_rotation is
  'Quarter-turns clockwise to apply when RENDERING keytag_photo_url. The stored file is never re-encoded — this is display metadata, so a wrong turn costs a tap rather than image quality.';
