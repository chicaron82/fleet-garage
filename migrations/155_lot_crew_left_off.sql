-- 155 — Lot Lookout: people left off the crew line, remembered across days.
--
-- Aaron, 2026-10-15 21:03, looking at the module's driver list: *"removing Larry C from being displayed as a
-- driver. even though he's on the driver schedule, he's our in-house utility guy doing vehicle maintenence"*.
-- While on shift he was counted as a driver "to the airport" on the read-only view, one more than really runs.
-- His call on the shape (*"your rec"*): a switch FG remembers, with a list to bring someone back, rather than a
-- name written into the code.
--
-- One row per person left off; deleting the row brings them back. No reason column, on purpose: this says only
-- "not part of the bay/airport line", never why.
--
-- Same shut door as lot_crew (migration 154): RLS on, no policy, no browser grants. Only api/lot.ts (service role)
-- reads or writes it, and only for a signed-in FG session.
create table if not exists public.lot_crew_left_off (
  user_id uuid primary key,
  left_by text,
  left_at timestamptz not null default now()
);
alter table public.lot_crew_left_off enable row level security;
revoke all on public.lot_crew_left_off from anon, authenticated;
grant all on public.lot_crew_left_off to service_role;
