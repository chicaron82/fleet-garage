-- Profiles table: links auth.users to app-level identity (role, branch, employee ID)
create table if not exists public.profiles (
  id          uuid        primary key references auth.users(id) on delete cascade,
  employee_id text        not null unique,
  name        text        not null,
  role        text        not null,
  branch_id   text        not null,
  created_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Any authenticated user can read all profiles (schedule, audit crew, etc. need this)
create policy "Authenticated users can read profiles"
  on public.profiles
  for select
  to authenticated
  using (true);
