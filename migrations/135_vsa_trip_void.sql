-- 135 — a logged send that never actually happened.
--
-- Aaron, 2026-09-01: his boss picked five cars for FastAir, he captured five tags and logged
-- them through Effie — and then a driver ignored the note on the board and took different cars.
-- Two went to the airport instead; a third sat at Erin St until FastAir filled up and it was
-- re-sent to AV Flight. So three of five rows recorded a send that did not occur.
--
-- The only correction available was to ask DiZee to delete the rows from Supabase by hand, which
-- he did — and that is how this came up: *"maybe a way for me to delete something that was
-- 'sent'. I think the only way to do it is to ask you or hunt for it myself in supabase."*
--
-- ⭐ VOID, NOT DELETE — and the distinction is invisible to him on purpose. His requirement is
-- absolute: *"I just need to know what was actually sent. not what planned on getting sent but
-- then didn't."* So every read filters `voided_at IS NULL` and a voided send is simply gone from
-- the manifests. The row survives only in the database, for two reasons:
--   1. UNDO. He voids from a phone in a washbay; a hard delete from there has no way back.
--   2. The correction is itself information. When two rows were deleted on Aug 31 they left no
--      trace at all — the only reason the gap was ever noticed is that the id scheme happens to
--      leak the original batch index. That is an accident, not an audit trail.
alter table public.vsa_trips add column if not exists voided_at  timestamptz;
alter table public.vsa_trips add column if not exists void_reason text;

comment on column public.vsa_trips.voided_at is
  'Set when a logged trip did not actually happen (a planned overflow send a driver never took). Every read filters voided_at IS NULL: the operator must see what was ACTUALLY sent, never what was planned and then did not go. Kept rather than deleted so a mis-tap is recoverable and so the correction itself is not lost.';
comment on column public.vsa_trips.void_reason is
  'Free text, the operator''s own words for why it did not go. Optional.';

-- Partial index: every read is "the live ones", so the index only needs to cover those.
create index if not exists vsa_trips_voided_at_idx on public.vsa_trips (voided_at) where voided_at is null;
