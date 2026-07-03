-- 089_shift_attendance.sql
-- Per-shift attendance, layered ON TOP of the roster — it never overwrites
-- shift_type (who was scheduled), it records who actually showed:
--   NULL      = scheduled (unmarked, the default)
--   'present' = confirmed on shift today
--   'absent'  = no-show / called in sick
-- Tapped from the My-Day "on with you today" pills (scheduled → present →
-- absent → scheduled). Additive + nullable, so existing rows/queries are
-- untouched. A later pass can feed the actual-present count into the washbay
-- team size / throughput rate.
alter table public.shifts
  add column if not exists attendance text
  check (attendance in ('present', 'absent'));
