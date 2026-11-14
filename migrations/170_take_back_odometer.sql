-- 170: Take back a wrong odo, days later (2026-11-14, docs/November/ticket-odo-take-back-newest.md).
-- Aaron: *"i'd leave a record of its sighting on that date. just the odo is incorrect. but a way to undo the incorrect
-- odo so yesterday's can be entered."* LJF712 had taken 37,331 off a Nov 8 sheet (entered Nov 11), ~5,700 km high, and
-- the real 31,787 from Nov 13 then read as going backwards. The in-the-moment Undos were long gone.
--
-- ⭐ The car's NEWEST reading only, guarded on it still being the car's current: a reading that landed since is never
-- taken back, and older readings stay locked. The reading is VOIDED, not deleted (the history keeps that it was taken
-- back); the sighting is not touched. The car goes back to the live reading before it, with that reading's own date.
-- No reading before it = 'no_previous', and nothing changes (Clear is the answer to "not logged").
--
-- ⚠️ Voided explicitly, not left to odometer_reading_log: the trigger voids only when the number goes DOWN, and a
-- wrong-LOW newest reading (a dropped digit) goes back UP to the one before it.
create or replace function public.take_back_odometer(p_vehicle text, p_km integer, p_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  cur  record;
  prev record;
begin
  select id, odometer, odometer_at into cur from public.vehicles where id = p_vehicle for update;
  if not found then return jsonb_build_object('status', 'no_car'); end if;
  -- Within a millisecond: the client's copy of the instant has been through JSON.
  if cur.odometer is distinct from p_km or cur.odometer_at is null or p_at is null
     or abs(extract(epoch from (cur.odometer_at - p_at))) > 0.001 then
    return jsonb_build_object('status', 'not_current');
  end if;

  select km, read_at into prev from public.odometer_readings
   where vehicle_id = p_vehicle and voided_at is null and read_at < cur.odometer_at
   order by read_at desc limit 1;
  if not found then return jsonb_build_object('status', 'no_previous'); end if;

  update public.odometer_readings set voided_at = now()
   where vehicle_id = p_vehicle and km = cur.odometer and read_at = cur.odometer_at and voided_at is null;
  update public.vehicles set odometer = prev.km, odometer_at = prev.read_at where id = p_vehicle;
  return jsonb_build_object('status', 'taken_back', 'km', prev.km, 'at', prev.read_at);
end $$;

grant execute on function public.take_back_odometer(text, integer, timestamptz) to anon, authenticated, service_role;
