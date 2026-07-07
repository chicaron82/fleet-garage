-- 091: provenance on a hold — where the flag came FROM. Null/absent = hand-flagged (the
-- existing behaviour, unchanged); 'effie' = written through Effie (a confirm-card tap or a
-- pending-queue approval). Surfaced as "Flagged by <name> · via Effie" so an Effie-born
-- record is visibly distinct from a manual one. Text (not boolean) on purpose — future
-- sources ('keytag-scan', 'inventory', …) reuse the same column. Idempotent.
-- See docs/ticket-holds-via-effie-attribution.md.
alter table public.holds
  add column if not exists flagged_source text;

comment on column public.holds.flagged_source is
  'Origin of the flag: null = hand-flagged, ''effie'' = written through Effie (confirm card or pending-queue approval). Extensible to other sources.';
