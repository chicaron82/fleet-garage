-- Core tables that were built manually in the Supabase dashboard and never
-- had migration files. CREATE TABLE IF NOT EXISTS is a no-op when the table
-- already exists; ADD COLUMN IF NOT EXISTS patches any missing columns safely.

-- ── vehicles ─────────────────────────────────────────────────────────────────

create table if not exists vehicles (
  id             text        primary key,
  unit_number    text        not null,
  license_plate  text        not null,
  make           text        not null,
  model          text        not null,
  year           integer     not null,
  color          text        not null,
  status         text        not null default 'HELD',
  branch_id      text,
  created_at     timestamptz not null default now()
);

alter table vehicles add column if not exists branch_id  text;
alter table vehicles add column if not exists created_at timestamptz not null default now();

create index if not exists idx_vehicles_branch_id on vehicles(branch_id);
create index if not exists idx_vehicles_status    on vehicles(status);

alter table vehicles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'vehicles' and policyname = 'Allow all access') then
    create policy "Allow all access" on vehicles for all using (true) with check (true);
  end if;
end $$;


-- ── holds ─────────────────────────────────────────────────────────────────────
-- branch_id added by 007, hold_types by 011 — both use ADD COLUMN IF NOT EXISTS
-- so re-running those migrations or this one is always safe.

create table if not exists holds (
  id                  text        primary key,
  vehicle_id          text        not null,
  hold_type           text        not null default 'damage',
  hold_types          text[],
  detail_reason       text,
  damage_description  text        not null default '',
  flagged_by_id       text        not null,
  flagged_at          timestamptz not null default now(),
  notes               text        not null default '',
  photos              text[],
  status              text        not null default 'ACTIVE',
  linked_hold_id      text,
  branch_id           text        not null default 'YWG',
  created_at          timestamptz not null default now()
);

alter table holds add column if not exists hold_types     text[];
alter table holds add column if not exists detail_reason  text;
alter table holds add column if not exists photos         text[];
alter table holds add column if not exists linked_hold_id text;
alter table holds add column if not exists branch_id      text not null default 'YWG';
alter table holds add column if not exists created_at     timestamptz not null default now();

create index if not exists idx_holds_vehicle_id on holds(vehicle_id);
create index if not exists idx_holds_status     on holds(status);
create index if not exists idx_holds_branch_id  on holds(branch_id);

alter table holds enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'holds' and policyname = 'Allow all access') then
    create policy "Allow all access" on holds for all using (true) with check (true);
  end if;
end $$;


-- ── releases ─────────────────────────────────────────────────────────────────

create table if not exists releases (
  id                      text        primary key,
  hold_id                 text        not null references holds(id) on delete cascade,
  approved_by_id          text        not null,
  approved_at             timestamptz not null default now(),
  release_type            text        not null default 'EXCEPTION',
  release_method          text        not null default 'standard',
  override_authorization  text,
  reason                  text        not null default '',
  expected_return         text,
  actual_return           text,
  notes                   text        not null default '',
  created_at              timestamptz not null default now()
);

alter table releases add column if not exists release_type           text not null default 'EXCEPTION';
alter table releases add column if not exists release_method         text not null default 'standard';
alter table releases add column if not exists override_authorization text;
alter table releases add column if not exists expected_return        text;
alter table releases add column if not exists actual_return          text;
alter table releases add column if not exists created_at             timestamptz not null default now();

create index if not exists idx_releases_hold_id on releases(hold_id);

alter table releases enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'releases' and policyname = 'Allow all access') then
    create policy "Allow all access" on releases for all using (true) with check (true);
  end if;
end $$;
