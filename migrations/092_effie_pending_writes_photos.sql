-- 092: Let a STAGED hold carry its damage photos through the pending queue.
--
-- A plain `hold` proposal (existing vehicle + damage photos) attaches those photos to
-- the hold record on confirm — but the photos live in the chat conversation, not in the
-- serialized Proposal. So when such a hold is STAGED ("Later") instead of confirmed, the
-- photos were dropped: the pending row had the proposal but no images, and approving it
-- from the queue (which has no chat context) wrote a hold with no damage photos.
--
-- Fix: stash the attached photos (base64 data URLs) on the pending row at stage time.
-- On approve, the queue feeds them into the same write path (useProposalConfirm), so a
-- staged damage hold lands its photos exactly like a confirmed one would. addHold uploads
-- them to storage on approve, so the data URLs only need to survive stage -> approve.
--
-- Nullable: most staged writes (register / register+hold, where the chat image is a keytag
-- artifact, not damage) carry no photos. Idempotent. RLS unchanged (allow-all, FG posture).
alter table public.effie_pending_writes
  add column if not exists photos jsonb;  -- array of base64 data URLs, or null

comment on column public.effie_pending_writes.photos is
  'Damage photos (base64 data URLs) attached to a staged hold, captured at stage time so they survive stage->approve. Uploaded to storage by addHold on approval. Null for writes with no attached photos.';
