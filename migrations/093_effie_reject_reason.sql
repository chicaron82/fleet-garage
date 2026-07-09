-- 093: Capture WHY a staged Effie write was rejected — the correction-loop signal.
-- A bare reject (status flip, migration 090) records THAT she was wrong but never WHY:
-- the misread class code, the bad plate prefix, the wrong detail. That signal is thrown
-- away the moment the row resolves, and it can't be backfilled. This column banks it so a
-- "where Effie misfires" surface can turn rejections into tuning knowledge (codex / prefix /
-- prompt). See docs/ticket-misc-effie-correction-loop.md.
--
-- Free text, no CHECK: the reason set is driven by a typed const on the client
-- (rejectReasons) so it can grow without a migration. Null on approved rows and on
-- rejects made before this shipped (or dismissed without picking a reason).
--
-- Additive + nullable + idempotent — safe on the live table, no backfill, no data risk.
alter table public.effie_pending_writes
  add column if not exists reject_reason text;

comment on column public.effie_pending_writes.reject_reason is
  'Why a rejected row was rejected (wrong_class_code / wrong_plate / wrong_details / duplicate / not_needed) — the correction-loop signal. Null on approved rows. Free text, values driven by the client rejectReasons const.';
