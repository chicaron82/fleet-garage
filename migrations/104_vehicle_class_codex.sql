-- Codes Aaron has TAUGHT FG, on top of the curated table in api/_lib/vehicleClassCodex.ts.
--
-- Until now the codex only grew when he got stuck at a car, messaged me, and I hand-added a
-- mapping in a commit — reactive, and it always cost a deploy. `unknown_class_codes` (migration
-- 100) made the gaps self-reporting; this is the other half: the operator standing at the car
-- with the tag in his hand is the authority on what CDGT actually is, so let him say it once and
-- have every future scan resolve it.
--
-- Consulted only when the curated table MISSES, so a taught row fills a gap rather than silently
-- overriding a vetted mapping. Re-teaching the same code overwrites (the upsert IS the edit path).
create table if not exists vehicle_class_codex (
  code       text primary key,
  make       text not null,
  model      text not null,
  taught_by  uuid,
  taught_at  timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trusted-crew allow-all, matching unknown_class_codes (migration 100).
alter table vehicle_class_codex enable row level security;
drop policy if exists vehicle_class_codex_all on vehicle_class_codex;
create policy vehicle_class_codex_all on vehicle_class_codex using (true) with check (true);
