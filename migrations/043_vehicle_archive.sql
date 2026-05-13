alter table vehicles
  add column if not exists archived_at    timestamptz,
  add column if not exists archived_by_id text;
