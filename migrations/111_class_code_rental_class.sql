-- Learned classCode -> rental_class, taught by GROUND TRUTH: any keytag scan where BOTH the class
-- code (e.g. CVRS) AND the rental class (e.g. B) read clean records the mapping. A later scan of the
-- same code with an UNREADABLE class field then infers it (provenance = inferred; a clean read
-- outranks + self-corrects). The tags ARE the chart -- no photographed Hertz chart, no manual
-- backfill (Aaron, 2026-08-05). Twin of vehicle_class_codex (migration 104, code -> make/model);
-- same trusted-crew allow-all posture. Consulted only to FILL a blank class, never to override a
-- clean tag read (the field-provenance ladder: inferred < tag < manual).
create table if not exists class_code_rental_class (
  code         text primary key,
  rental_class text not null,
  learned_by   uuid,
  updated_at   timestamptz not null default now()
);

-- Trusted-crew allow-all, matching vehicle_class_codex (migration 104) and rental_classes (106).
alter table class_code_rental_class enable row level security;
drop policy if exists class_code_rental_class_all on class_code_rental_class;
create policy class_code_rental_class_all on class_code_rental_class using (true) with check (true);
