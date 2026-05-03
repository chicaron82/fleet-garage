create table if not exists lost_found (
  id              uuid primary key default gen_random_uuid(),
  branch_id       text not null,
  found_by        text not null,
  found_by_name   text not null,
  found_at        timestamptz not null default now(),
  key_tag_photo   text,
  item_photo      text,
  description     text,
  location        text,
  license_plate   text,
  unit_number     text,
  vehicle_make    text,
  status          text not null default 'holding',
  notes           text,
  resolved_at     timestamptz
);

alter table lost_found enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'lost_found' and policyname = 'Allow all access') then
    create policy "Allow all access" on lost_found for all using (true) with check (true);
  end if;
end $$;
