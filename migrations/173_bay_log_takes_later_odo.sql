-- 173: the bay log picks up an odo logged afterwards (2026-11-26, docs/ticket-bay-log-odo-shown.md). Aaron: *"can we
-- add the odo reading entered to the lot lookout abs read-only?"*, then *"Can it still show if I logged them afterwards?"*
--
-- lot_bay_log.odometer is set when a car starts (a reading from that shift day) or leaves (the bay card's odo). A
-- reading logged LATER only reached odometer_readings (168), which every odo path writes. So the rule hangs there:
--   • a live reading (insert, or un-voided by 168's on-conflict) fills that car's rows on the reading's shift day that
--     have NO odo. Never overwrites one.
--   • a voided reading (take-back 170, or 168's down-going auto-void) swaps rows holding that km on that day to the
--     newest live reading left that day, or null.
-- Shift day = UTC − 9 h: Winnipeg is UTC−5 year-round, plus the 04:00 cutover (api/_lib/shiftDay.ts). Deliberately not
-- 'America/Winnipeg': tz tables older than Manitoba's change read it an hour off.
-- SECURITY DEFINER: anon/authenticated can't write lot_bay_log (161), and a reading saved from his phone must still land.
create or replace function public.bay_log_shift_day(ts timestamptz) returns date
  language sql immutable set search_path = public as $$
  select (timezone('UTC', ts) - interval '9 hours')::date
$$;

create or replace function public.bay_log_take_reading() returns trigger
  language plpgsql security definer set search_path = public as $$
declare
  d    date := public.bay_log_shift_day(new.read_at);
  best integer;
begin
  if new.voided_at is null and (tg_op = 'INSERT' or old.voided_at is not null) then
    update public.lot_bay_log set odometer = new.km
     where vehicle_id = new.vehicle_id and shift_day = d and odometer is null;
  elsif tg_op = 'UPDATE' and old.voided_at is null and new.voided_at is not null then
    select r.km into best from public.odometer_readings r
     where r.vehicle_id = new.vehicle_id and r.voided_at is null and r.id <> new.id
       and public.bay_log_shift_day(r.read_at) = d
     order by r.read_at desc limit 1;
    update public.lot_bay_log set odometer = best
     where vehicle_id = new.vehicle_id and shift_day = d and odometer = new.km;
  end if;
  return new;
end $$;

drop trigger if exists odometer_readings_bay_log on public.odometer_readings;
create trigger odometer_readings_bay_log after insert or update of voided_at on public.odometer_readings
  for each row execute function public.bay_log_take_reading();

comment on function public.bay_log_take_reading() is
  'Fills lot_bay_log.odometer from a reading of the same car on the same shift day when the row has none; on a void, swaps to the newest live reading left that day (or null). Never overwrites a row''s own reading. Migration 173.';
