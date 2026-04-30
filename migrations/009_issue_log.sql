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
