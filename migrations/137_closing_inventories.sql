-- 137: Cross-device continuity for the closing inventory sheet (docs/ticket-closing-inventory-sync.md).
--
-- The sheet was localStorage-only, so 24 cars scanned on the phone at the yard were simply not there
-- when Aaron opened FG on his PC at home (2026-09-05). His rule: "these should be available. the
-- value of FG is being able to use it on anything."
--
-- ⚠️ The "no sync" decision it replaces was justified in-code by a FABRICATED QUOTE — a scenario a
-- past line-check invented to illustrate a race condition, later quoted as Aaron's own words. He
-- never said it. See the ticket.
--
-- Mirrors airport_flips (108): one row per user holding { day, entries, at }. localStorage stays the
-- instant/offline fast-path cache; this is the shared source of truth. Shift-day expiry still comes
-- from the `day` stamp inside the payload (cutover 04:00), unchanged.
--
-- ⚠️ Merge is PER-ROW by id/at, not whole-list last-write-wins — b93ccda fixed exactly that bug on
-- the flip, and the closing sheet's version is worse: a PC opened fresh would push an empty sheet
-- over 24 scanned cars. Deletes carry tombstones so a merge cannot resurrect a removed row.
--
-- RLS allow-all (FG trusted-crew/personal tool).
create table if not exists public.closing_inventories (
  user_id     text primary key,
  sheet       jsonb not null,     -- { day: 'YYYY-MM-DD', entries: InventoryEntry[], at: epoch_ms }
  updated_at  timestamptz not null default now()
);

comment on table public.closing_inventories is
  'Per-user closing inventory sheet for cross-device continuity. Server = shared source of truth; localStorage = fast-path/offline cache. Shift-day expiry via the `day` stamp inside the payload; PER-ROW merge by id/at with tombstones (src/hooks/useClosingInventory + src/lib/closingInventorySync). See docs/ticket-closing-inventory-sync.md.';

alter table public.closing_inventories enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'closing_inventories' and policyname = 'closing_inventories_all'
  ) then
    create policy closing_inventories_all on public.closing_inventories for all using (true) with check (true);
  end if;
end $$;
