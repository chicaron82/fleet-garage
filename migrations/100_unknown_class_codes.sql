-- 100_unknown_class_codes.sql
--
-- The self-reporting codex. When a key tag prints a vehicle CLASS CODE that
-- api/_lib/vehicleClassCodex.ts can't resolve, the scan appends a sighting here
-- (src/hooks/useUnknownClassCode.ts, fire-and-forget). Codes then accumulate on
-- their own instead of waiting for someone to get blocked at a car and report it
-- — the CDGT/Durango case that prompted this on 2026-07-19.
--
-- Append-only by design: every row is one sighting, duplicates are a true record
-- of two scans, and nothing reads it as a unique key. That's why it is EXEMPT
-- from withSubmitLock (recorded in tests/architecture/submit-lock-contract.test.ts).
--
-- NOTE: this table was applied live via the Management API on 2026-07-19 and this
-- file was written after the fact at /reflect 45 — the live table already exists,
-- so everything here is idempotent and safe to re-run.

create table if not exists unknown_class_codes (
  id      uuid primary key default gen_random_uuid(),
  code    text not null,
  plate   text,
  seen_at timestamptz not null default now()
);

create index if not exists unknown_class_codes_code_idx on unknown_class_codes (code);

alter table unknown_class_codes enable row level security;

-- Trusted-crew allow-all, matching every other table in this project
-- ([[project_fg_scope_boundary]] — FG is single-operator by design).
drop policy if exists unknown_class_codes_all on unknown_class_codes;
create policy unknown_class_codes_all on unknown_class_codes
  for all using (true) with check (true);
