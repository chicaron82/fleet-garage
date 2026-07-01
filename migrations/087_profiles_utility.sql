-- 087: mark a non-driver utility/maintenance staffer (e.g. the in-house PM-cars
-- person) so the schedule can shade + tag their row distinctly from drivers.
-- Display-only — does NOT change role or scheduling group. Idempotent.
alter table public.profiles
  add column if not exists utility boolean not null default false;

comment on column public.profiles.utility is
  'Display flag: a utility/maintenance staffer (e.g. PM-cars) whose schedule row is shaded + tagged to set them apart from drivers. Does not affect role/grouping.';
