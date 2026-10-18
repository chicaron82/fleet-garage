-- 157 — Lot Lookout, airport: two readings and a flag replace the stall board.
--
-- ⭐ THE ASK. Aaron, 2026-10-18 11:35: *"picking between three states is a little much. especially when moving
-- quickly. drivers picking up and going. what do you think of pivoting to 2 sliders / room for clean, they'd rate from
-- 0 to ~full cleans (gradient red to green) / returns, packed to 0 (same gradient) / and a tap if vehicles parked in
-- the aisle"*. Why "room for clean" (11:39): *"to make the call from the bay if i should pull the VSA's personally to
-- move cars before management decides to do it when its inconvenient"*. So the reading is for the BAY.
--
-- His rulings over the mock (11:54): *"notches are fine, scrap the stale time and stall map"*. Five notches each, 0..4:
--   cleans   0 Empty · 1 Low · 2 Half · 3 Most · 4 Full     (0 = lots of room up there)
--   returns  0 Packed · 1 Lots · 2 Some · 3 Few · 4 Clear
-- Red is the low end of both: time to move cars. Ticket: docs/ticket-lot-lookout-swatches-too-many-targets.md.
--
-- ⭐ Each reading keeps the time the finger hit the glass, not the time it reached the server: a tap made in the
-- parkade with no signal waits on the phone and is sent later (docs/ticket-lot-lookout-taps-wait-for-signal.md). The
-- server applies it only if it is newer than what the row already holds, so a late phone never overwrites a fresher
-- reading. Every tap is logged either way (`applied`).
--
-- Same posture as 151/153: READ-ONLY to the browser's keys, written only by api/lot.ts (PIN or a signed-in session).
-- lot_stalls / lot_aisle / lot_taps stay as history; nothing writes them after this.

create table if not exists public.lot_airport (
  id           int         primary key default 1 check (id = 1),
  cleans       smallint    check (cleans between 0 and 4),     -- null = never read
  cleans_by    text,
  cleans_at    timestamptz,
  returns      smallint    check (returns between 0 and 4),    -- null = never read
  returns_by   text,
  returns_at   timestamptz,
  aisle        boolean     not null default false,
  aisle_by     text,
  aisle_at     timestamptz
);
comment on table public.lot_airport is
  'Lot Lookout, airport: room for cleans (0 Empty..4 Full), returns waiting (0 Packed..4 Clear), cars in the aisle. One row, each reading with its tap time. Written ONLY by api/lot.ts. Aaron 2026-10-18.';

create table if not exists public.lot_airport_taps (
  id           bigint      generated always as identity primary key,
  field        text        not null check (field in ('cleans', 'returns', 'aisle')),
  value        smallint    not null,                 -- the notch 0..4, or 0/1 for the aisle
  prev         smallint,
  tapped_by    text,
  tapped_at    timestamptz not null,                 -- when the finger hit the glass
  received_at  timestamptz not null default now(),   -- when it reached the server (later = it waited for signal)
  applied      boolean     not null                  -- false = a fresher reading was already there
);
comment on table public.lot_airport_taps is
  'Lot Lookout, airport: every reading tap. tapped_at is the phone''s time; received_at - tapped_at is how long it waited for signal; applied=false when a newer reading had already landed.';
create index if not exists lot_airport_taps_at_idx on public.lot_airport_taps (tapped_at desc);

insert into public.lot_airport (id) values (1) on conflict (id) do nothing;

alter table public.lot_airport      enable row level security;
alter table public.lot_airport_taps enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_airport' and policyname = 'lot_airport_read') then
    create policy lot_airport_read on public.lot_airport for select using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'lot_airport_taps' and policyname = 'lot_airport_taps_read') then
    create policy lot_airport_taps_read on public.lot_airport_taps for select using (true);
  end if;
end $$;

revoke insert, update, delete, truncate on public.lot_airport, public.lot_airport_taps from anon, authenticated;
grant select on public.lot_airport, public.lot_airport_taps to anon, authenticated;
grant all on public.lot_airport, public.lot_airport_taps to service_role;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'lot_airport') then
    alter publication supabase_realtime add table public.lot_airport;
  end if;
end $$;
