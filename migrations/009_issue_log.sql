create table facility_issues (
  id            uuid primary key default gen_random_uuid(),
  branch_id     text not null,
  title         text not null,
  description   text,
  severity      text not null default 'medium',
  reported_by   text not null,
  reported_at   timestamptz not null default now(),
  cleared_by    text,
  cleared_at    timestamptz,
  notes         text
);

alter table facility_issues enable row level security;

create policy "read"   on facility_issues for select to authenticated using (true);
create policy "insert" on facility_issues for insert to authenticated with check (true);
create policy "update" on facility_issues for update to authenticated using (true);
