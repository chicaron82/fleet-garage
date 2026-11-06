-- 166: On break (2026-11-05, docs/ticket-lot-bay-on-break.md). Aaron: *"what do you think of a "on break" button for me
-- ... since i'm off the floor the count would be inaccurate. a heads up on the read-only side?"*.
-- When he went on break; null = not on one. A break counts only while nothing has happened since it began, so any tap
-- ends it without this being cleared (src/lib/countKept.ts). Additive.
alter table public.lot_bay add column if not exists break_at timestamptz;
comment on column public.lot_bay.break_at is
  'When he went on break (Lot Lookout''s On break). Null = not on one. Any later tap ends it; the read-only page shows a heads-up while it holds.';
