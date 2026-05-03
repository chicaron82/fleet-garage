-- Patch: add base columns that 016 missed in its ALTER TABLE section.
-- 016 patched the VSA-specific columns but not the core ones — if the table
-- was manually created without these, they were never added.

alter table vsa_trips add column if not exists vehicle_plate   text;
alter table vsa_trips add column if not exists trip_type       text;
alter table vsa_trips add column if not exists depart_location text;
alter table vsa_trips add column if not exists arrive_location text;
alter table vsa_trips add column if not exists depart_time     timestamptz;
alter table vsa_trips add column if not exists arrive_time     timestamptz;
alter table vsa_trips add column if not exists driver_id       text;

-- RLS + permissive policy (same pattern as all other tables)
alter table vsa_trips enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'vsa_trips' and policyname = 'Allow all access') then
    create policy "Allow all access" on vsa_trips for all using (true) with check (true);
  end if;
end $$;
