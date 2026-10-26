-- 160 — A second stretch of hours on the same day.
--
-- Aaron, 2026-10-26: worked his 06:45–15:15 opening, went home, and was asked back for 17:00–21:00 because the
-- closing VSA called in sick. `shifts` is unique on (user_id, date), so the day has ONE row and one actual
-- start/end. Logging 06:45–21:00 would pay the 1h45 he spent at home; logging either block alone drops the other.
-- His fix: *"maybe a [+] line?"* … *"Under log actual hours"*.
--
-- NULL (or an empty array) = no extra hours, so every existing row reads exactly as before.
-- Otherwise an array of {"start":"HH:MM","end":"HH:MM"}: each block is worked time on top of the main actuals,
-- netted on its own through ot.ts `netActualHours` (a 4h block owes no break).
alter table public.shifts
  add column if not exists extra_blocks jsonb;

alter table public.shifts drop constraint if exists shifts_extra_blocks_check;
alter table public.shifts
  add constraint shifts_extra_blocks_check check (extra_blocks is null or jsonb_typeof(extra_blocks) = 'array');

comment on column public.shifts.extra_blocks is
  'Extra worked blocks on the same day, [{start,end}] as HH:MM. NULL = none. Each nets through the standard break rule.';
