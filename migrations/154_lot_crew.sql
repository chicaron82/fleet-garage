-- 154 — Lot Lookout: today's crew, what each one is doing right now.
--
-- ⭐ THE ASK. Aaron, 2026-10-15 14:29: *"What if we included the day roster. Who's cleaning and who's driving. On my
-- view it's editable. If VSA's are pulled. 2 buttons ALL, SELECTED ... If someone is sick. Crossed off. Could work
-- for drivers too. If they've been pulled to do something else."* His go, 14:32 (on overtime): *"Let's cook"*.
-- Ticket: docs/ticket-lot-lookout-day-crew.md.
--
-- The roster itself is FG's `shifts`; this table holds only what HE changed today: one row per person, OVERWRITTEN,
-- stamped with the shift-day it belongs to. A row from another day reads as "not changed". No per-day rows, so it
-- can never become a history of who was pulled or who was out (FG rule: don't track coworkers' hours).
--
-- ⚠️ Not readable from the browser at all (unlike lot_stalls / lot_bay). It holds people, not cars. api/lot.ts reads
-- it with the service role: the public /lot/view gets NUMBERS only, and only a signed-in FG session gets names (his
-- calls, 14:31: the read-only view shows numbers, never names; "out" is one plain state, never a reason).

create table if not exists public.lot_crew (
  user_id    uuid        primary key,
  state      text        not null check (state in ('cleaning', 'moving', 'airport', 'other', 'out')),
  day        date        not null,
  tapped_by  text,
  tapped_at  timestamptz not null default now()
);
comment on table public.lot_crew is
  'Lot Lookout: what each person on today''s shift is doing, when Aaron changed it. One row per person, overwritten; another day''s row means "not changed". Service role only. Aaron 2026-10-15.';

alter table public.lot_crew enable row level security;
-- No policy: RLS on with no policy shuts every browser key out. Grants say the same thing.
revoke all on public.lot_crew from anon, authenticated;
grant all on public.lot_crew to service_role;
