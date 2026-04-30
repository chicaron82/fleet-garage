create table washbay_logs (
  id                   uuid primary key default gen_random_uuid(),
  branch_id            text not null,
  date                 date not null,
  full_pages           integer not null default 0,
  last_page_entries    integer not null default 0,
  cars_remaining       integer not null default 0,
  clean_not_picked_up  integer not null default 0,
  team_size            integer not null,
  shift_hours          numeric(4,1) not null default 8,
  logged_by            text not null,
  logged_at            timestamptz not null default now(),
  unique(branch_id, date)
);

-- RLS: anon role (app uses anon key — no Supabase Auth)
alter table washbay_logs enable row level security;

create policy "read"   on washbay_logs for select to anon using (true);
create policy "insert" on washbay_logs for insert to anon with check (true);
create policy "update" on washbay_logs for update to anon using (true);
