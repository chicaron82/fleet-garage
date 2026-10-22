-- 159 — How long the unpaid break really was.
--
-- Aaron, 2026-10-22, after a solo opening that ran to 16:36: *"0630-1636 with a shortened break of 15m instead of
-- 30m"*, then *"log actual hours can also log how long a break was taken"*. FG deducted a fixed 30 minutes from any
-- worked span over 5h (ot.ts and shift-metrics.ts), so a shortened break was paid time FG could not see: that day
-- read 9h36m worked against a true 9h51m, and the OT came up 15 minutes short.
--
-- NULL = the standard rule (30 min once the span passes 5h), so every existing row reads exactly as before.
-- A number = the break he actually took, in minutes, and it replaces the rule (0 means no break at all).
alter table public.shifts
  add column if not exists break_minutes smallint;

alter table public.shifts drop constraint if exists shifts_break_minutes_check;
alter table public.shifts
  add constraint shifts_break_minutes_check check (break_minutes between 0 and 240);

comment on column public.shifts.break_minutes is
  'Unpaid break actually taken, in minutes. NULL = the standard 30 min once a worked span passes 5h.';
