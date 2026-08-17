-- An optional photo on the two shift logs (2026-08-17, Aaron's ask — idea #1 of the evening):
--   *"whatcha think of adding a photo for additional context in the logs. totally optional. shift
--    hand-off. backlog was selected. photo of the board. closing washbay log. the board at around
--    close"*
--
-- WHY THIS EARNS A COLUMN. `lot_status` is a JUDGMENT — one of three words (zeroed / manageable /
-- backlog). Read back three weeks later, "backlog" tells you he felt behind; it cannot tell you
-- that 24 keys were hanging on the board. A photo of the key board is a MEASUREMENT of the same
-- fact by a second instrument: every key on a hook is a car sitting on the lot. It doesn't depend
-- on his adjectives or his memory, and it's the one field in either log that was pure opinion.
--
-- Both logs get it because they're structural twins — `handoff_notes` is the morning read and
-- `washbay_logs` is the close. Doing one would leave the other's lot_status un-evidenced, which is
-- worse than doing neither.
--
-- Nullable, always. The photo is optional by design: a log must never fail because the upload did,
-- and a shift where he didn't think to snap the board is a normal shift, not a broken record.
ALTER TABLE handoff_notes ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE washbay_logs  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Its own bucket, matching FG's one-bucket-per-domain pattern (damage-photos, issue-bucket,
-- lost-found-photos). Public read, same as the others: FG is a trusted-crew PoC and the app reads
-- these back through plain public URLs stored in the column above.
INSERT INTO storage.buckets (id, name, public)
VALUES ('shift-log-photos', 'shift-log-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies, mirroring the lost-found-photos set (the most complete of the existing three).
-- No DELETE policy: a shift log is a record of what was true at a moment, and letting the photo be
-- removed after the fact would quietly un-evidence a lot_status that someone may rely on later.
DROP POLICY IF EXISTS "shift-log-photos-insert" ON storage.objects;
CREATE POLICY "shift-log-photos-insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'shift-log-photos');

DROP POLICY IF EXISTS "shift-log-photos-select" ON storage.objects;
CREATE POLICY "shift-log-photos-select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'shift-log-photos');

-- UPDATE is needed for upsert-on-reupload: re-opening a same-day close overwrites its own photo
-- rather than orphaning the first one.
DROP POLICY IF EXISTS "shift-log-photos-update" ON storage.objects;
CREATE POLICY "shift-log-photos-update" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'shift-log-photos');
