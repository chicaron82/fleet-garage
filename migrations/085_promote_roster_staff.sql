-- 085_promote_roster_staff.sql
-- Promote a roster-only schedule ghost (migration 082) into a real FG account.
--
-- A roster ghost has a generated UUID, a fake ROSTER-* employee id, no auth row,
-- and (verified against live data) rows in exactly ONE table: `shifts`. When the
-- person actually gets an FG account — created out of band, since the app only
-- signs in; email convention `{employeeId}@fleet-garage.internal` — this bridges
-- the two: the ghost's whole schedule history carries to the real auth id, and the
-- ghost is retired. No orphaned shifts, no ghost+real duplicate.
--
-- SECURITY DEFINER because the profiles RLS (082) only lets clients touch
-- roster_only = true rows: creating a real (roster_only=false) profile and flipping
-- ownership both need elevated rights. Atomic by virtue of being one function body —
-- any failure rolls the whole promotion back. UI-gated to Lead VSA+ (same trust
-- model as addRosterStaff — RLS-open, UI-scoped; see the FG scope boundary).

create or replace function public.promote_roster_staff(p_roster_id uuid, p_employee_id text)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_ghost   public.profiles;
  v_auth_id uuid;
  v_email   text;
  v_taken   uuid;
  v_result  public.profiles;
begin
  -- 1. the source must be an existing roster ghost
  select * into v_ghost from public.profiles where id = p_roster_id;
  if not found then
    raise exception 'roster profile % not found', p_roster_id;
  end if;
  if not v_ghost.roster_only then
    raise exception 'profile % is a real account, not a roster ghost', p_roster_id;
  end if;

  -- 2. the new account must already exist (created out of band) — find it by the FG email
  v_email := lower(p_employee_id) || '@fleet-garage.internal';
  select id into v_auth_id from auth.users where lower(email) = v_email;
  if v_auth_id is null then
    raise exception 'no FG account for employee % — create the account (%) first', p_employee_id, v_email;
  end if;
  if v_auth_id = p_roster_id then
    raise exception 'cannot promote a ghost onto itself';
  end if;

  -- 3. the real employee id must not already belong to a different account
  select id into v_taken from public.profiles where employee_id = p_employee_id and id <> v_auth_id;
  if v_taken is not null then
    raise exception 'employee id % already belongs to another profile (%)', p_employee_id, v_taken;
  end if;

  -- 4. create (or update) the real profile for the new auth id, carrying the ghost's identity
  insert into public.profiles (id, employee_id, name, role, branch_id, roster_only)
  values (v_auth_id, p_employee_id, v_ghost.name, v_ghost.role, v_ghost.branch_id, false)
  on conflict (id) do update
    set employee_id = excluded.employee_id,
        name        = excluded.name,
        role        = excluded.role,
        branch_id   = excluded.branch_id,
        roster_only = false
  returning * into v_result;

  -- 5. carry the schedule history over (shifts is the ghost's only data — verified)
  update public.shifts set user_id = v_auth_id::text where user_id = p_roster_id::text;

  -- 6. retire the ghost
  delete from public.profiles where id = p_roster_id;

  return v_result;
end;
$$;

revoke execute on function public.promote_roster_staff(uuid, text) from public;
grant  execute on function public.promote_roster_staff(uuid, text) to authenticated;
