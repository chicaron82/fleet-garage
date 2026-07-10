-- 094: Graduated autonomy L2, SHADOW mode (docs/ticket-misc-effie-graduated-autonomy.md).
-- Before any write ever fires itself, we run the auto-clear gate in observe-only: record whether
-- the DETERMINISTIC gate WOULD have auto-cleared a staged backfill, but still require the operator's
-- tap. The verdict accrues on the row so a track record builds ("the gate said yes on these — was it
-- right?") — the evidence that justifies the eventual flip to live. NOTHING auto-fires from this.
--
-- Semantics:
--   null  = not shadow-evaluated (registers, holds, chat-staged writes — never auto-clear candidates)
--   true  = a backfill the deterministic gate would auto-clear (clean read; pending the misfire-rate
--           check that the LIVE gate will add)
--   false = a backfill the gate would NOT auto-clear (e.g. the plate needed a prefix correction)
--
-- Additive + nullable + idempotent — safe on the live table, no backfill, no data risk.
alter table public.effie_pending_writes
  add column if not exists would_auto_clear boolean;

comment on column public.effie_pending_writes.would_auto_clear is
  'Shadow-mode verdict of the deterministic auto-clear gate (L2). null = not evaluated; true/false = would/would-not auto-clear a backfill. Observe-only — nothing fires from this. See src/lib/autoClearGate + docs/ticket-misc-effie-graduated-autonomy.md.';
