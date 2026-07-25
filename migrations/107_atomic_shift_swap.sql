-- 107_atomic_shift_swap.sql
-- Make shift swap / give-away ATOMIC.
--
-- Before: each was TWO sequential client writes (useShiftSwap.ts) with a
-- best-effort restore-both on failure. If leg 2 threw *after* its write had
-- already landed, and its restore ALSO failed (the `.catch(() => {})` swallowed
-- it), the grid was left in a residual half-swap. This bit Aaron live 2026-07-24:
-- swapping Rey (on) with Robert (off) put Robert on the shift but never cleared
-- Rey -- both ended up on. A single transaction removes the two-write window
-- entirely: either the whole swap commits or nothing does, so no half-state can
-- exist and there is no client-side restore to swallow.
--
-- Constraint-safety (identical to the old client logic in lib/shiftSwap.ts): we
-- swap each shift's schedulable CONTENT (shift_type + start/end time) and never
-- touch user_id or date, so shifts_user_date_unique (user_id, date) is never in
-- play. Only the three content fields + notes move; attendance, actual_*, is_stat,
-- pto_approved, pto_alternate_date stay put on their own row.
--
-- SECURITY INVOKER (the default -- deliberately not `security definer`): the
-- functions run with the caller's rights and RLS, exactly like the client
-- updateShift/createShift they replace. No privilege escalation; still UI-gated to
-- Lead VSA+ (same trust model as SwapShiftSheet, see the FG scope boundary).

-- Direct swap: two crew trade same-day shifts. Each row takes on the other's
-- content; user_id and date are untouched, so the end state equals trading
-- ownership without ever transiently violating the unique constraint.
create or replace function public.swap_shift_content(
  p_a_id uuid, p_b_id uuid, p_note text default null
)
returns setof public.shifts
language plpgsql
as $$
declare
  v_a public.shifts;
  v_b public.shifts;
begin
  if p_a_id = p_b_id then
    raise exception 'cannot swap a shift with itself';
  end if;

  -- Lock both rows for the duration so a concurrent edit can't interleave.
  select * into v_a from public.shifts where id = p_a_id for update;
  if not found then raise exception 'shift % not found', p_a_id; end if;
  select * into v_b from public.shifts where id = p_b_id for update;
  if not found then raise exception 'shift % not found', p_b_id; end if;

  update public.shifts
     set shift_type = v_b.shift_type,
         start_time = v_b.start_time,
         end_time   = v_b.end_time,
         notes      = p_note,
         updated_at = now()
   where id = p_a_id;

  update public.shifts
     set shift_type = v_a.shift_type,
         start_time = v_a.start_time,
         end_time   = v_a.end_time,
         notes      = p_note,
         updated_at = now()
   where id = p_b_id;

  return query select * from public.shifts where id in (p_a_id, p_b_id);
end;
$$;

-- Give-away: the giver drops to a day-off and the taker inherits the giver's
-- content -- into the taker's existing same-day row if they have one, else a new
-- row. Same atomicity guarantee: giver + taker move together or not at all.
create or replace function public.give_away_shift(
  p_giver_id uuid, p_taker_id text, p_taker_shift_id uuid default null, p_note text default null
)
returns setof public.shifts
language plpgsql
as $$
declare
  v_giver    public.shifts;
  v_taker_id uuid;
begin
  -- Capture the giver's content BEFORE it is dropped to day-off below.
  select * into v_giver from public.shifts where id = p_giver_id for update;
  if not found then raise exception 'shift % not found', p_giver_id; end if;

  if p_taker_shift_id is not null then
    update public.shifts
       set shift_type = v_giver.shift_type,
           start_time = v_giver.start_time,
           end_time   = v_giver.end_time,
           notes      = p_note,
           updated_at = now()
     where id = p_taker_shift_id
    returning id into v_taker_id;
    if v_taker_id is null then raise exception 'taker shift % not found', p_taker_shift_id; end if;
  else
    -- New row for a taker with no same-day shift. ON CONFLICT guards the race
    -- where a row appeared between the client's check and this call (the DB-level
    -- analogue of createShift's JS submit-lock).
    insert into public.shifts (user_id, date, shift_type, start_time, end_time, notes)
    values (p_taker_id, v_giver.date, v_giver.shift_type, v_giver.start_time, v_giver.end_time, p_note)
    on conflict (user_id, date) do update
       set shift_type = excluded.shift_type,
           start_time = excluded.start_time,
           end_time   = excluded.end_time,
           notes      = excluded.notes,
           updated_at = now()
    returning id into v_taker_id;
  end if;

  update public.shifts
     set shift_type = 'day-off',
         start_time = null,
         end_time   = null,
         notes      = p_note,
         updated_at = now()
   where id = p_giver_id;

  return query select * from public.shifts where id in (p_giver_id, v_taker_id);
end;
$$;

revoke execute on function public.swap_shift_content(uuid, uuid, text) from public;
grant  execute on function public.swap_shift_content(uuid, uuid, text) to authenticated;
revoke execute on function public.give_away_shift(uuid, text, uuid, text) from public;
grant  execute on function public.give_away_shift(uuid, text, uuid, text) to authenticated;
