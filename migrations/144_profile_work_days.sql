-- 144 — work_days: the weekdays a person can be scheduled, when that is a rule rather than a habit.
--
-- ⚠️ THE RULE (Aaron, 2026-09-14, confirming the Sep 14–20 driver import): *"Grant can only work
-- Tues and Thurs. if scheduled any other day, its an error."* Until now it lived in his head, and was
-- checked that morning only because he had just said it.
--
-- ⭐ A COLUMN, NOT A NAME CHECK. Grant is the first person with a value; the next person with the same
-- kind of constraint needs a row edit, not a code change.
--
-- ISO weekdays: 1 = Monday … 7 = Sunday. NULL = any day (everyone, by default).
--
-- ⚠️ It constrains WORKING shifts only — a pto / sick / day-off row on another day is not a conflict
-- (Grant's own Sep 14–20 week is VAC on exactly his two days). The check lives in
-- src/lib/workDays.ts, and it WARNS rather than refuses: the posted sheet is still what was posted.

alter table public.profiles
  add column if not exists work_days smallint[]
  check (work_days is null or (cardinality(work_days) between 1 and 7 and work_days <@ array[1,2,3,4,5,6,7]::smallint[]));

comment on column public.profiles.work_days is
  'ISO weekdays (1=Mon..7=Sun) this person can be scheduled to WORK. NULL = any day. Warned on, never enforced (migration 144).';

update public.profiles set work_days = array[2,4]::smallint[]
  where name = 'Grant' and role = 'Driver' and roster_only;
