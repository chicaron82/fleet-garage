-- 108: Cross-device continuity for the Airport Flip list (docs/July/ticket-flip-cross-device.md).
-- The flip list was localStorage-only (per-device), so returns captured on the phone at the airport
-- never showed on the computer at home. This makes the list follow the USER: server = shared source
-- of truth, localStorage stays the instant/offline fast-path cache. Mirrors effie_threads (096).
-- One row per user holding { day, rows, at } — the exact shape useAirportFlip already stores, plus an
-- `at` epoch stamp for last-write-wins hydration (a device adopts the server copy when it's newer).
-- The shift-day expiry still comes from the `day` stamp inside the payload (a stale day reads as
-- empty), unchanged. RLS allow-all (FG trusted-crew/personal tool, [[project_fg_scope_boundary]]).
create table if not exists public.airport_flips (
  user_id     text primary key,
  flips       jsonb not null,     -- { day: 'YYYY-MM-DD', rows: FlipRow[], at: epoch_ms }
  updated_at  timestamptz not null default now()
);

comment on table public.airport_flips is
  'Per-user Airport Flip list for cross-device continuity. Server = shared source of truth; localStorage = fast-path/offline cache. Shift-day expiry via the `day` stamp inside the payload; last-write-wins via `at` (src/hooks/useAirportFlip + src/lib/airportFlipSync). See docs/July/ticket-flip-cross-device.md.';

alter table public.airport_flips enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'airport_flips' and policyname = 'airport_flips_all'
  ) then
    create policy airport_flips_all on public.airport_flips for all using (true) with check (true);
  end if;
end $$;
