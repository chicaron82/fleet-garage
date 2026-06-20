-- 082: roster-only staff
-- Floor staff (VSAs, drivers) whose schedule is posted on the breakroom board but
-- who never log into FG. Team-size (rosteredVsaCount) reads the shifts table, so
-- once these people have shifts entered, the washbay count includes them — but a
-- profile can't exist for them today: profiles.id has a hard FK to auth.users.
--
-- This drops that FK so a profile can carry a generated UUID with no account, adds
-- a roster_only flag, and opens client-side CRUD *scoped to roster_only rows* —
-- real employees' profiles stay read-only. shifts.user_id is plain TEXT (no FK),
-- so a roster-only UUID owns shifts exactly like any real profile. Trusted-crew
-- PoC; allow-all posture by design.

-- 1. Let a profile exist without a backing auth.users row.
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- 2. Mark schedule-only staff.
alter table public.profiles add column if not exists roster_only boolean not null default false;

-- 3. Client CRUD for roster-only rows only (real profiles remain read-only).
drop policy if exists "Authenticated can insert roster staff" on public.profiles;
create policy "Authenticated can insert roster staff"
  on public.profiles for insert to authenticated
  with check (roster_only = true);

drop policy if exists "Authenticated can update roster staff" on public.profiles;
create policy "Authenticated can update roster staff"
  on public.profiles for update to authenticated
  using (roster_only = true) with check (roster_only = true);

drop policy if exists "Authenticated can delete roster staff" on public.profiles;
create policy "Authenticated can delete roster staff"
  on public.profiles for delete to authenticated
  using (roster_only = true);
