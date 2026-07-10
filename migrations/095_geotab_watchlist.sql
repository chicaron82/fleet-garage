-- 095: Geotab install watchlist (docs/ticket-geotab-watchlist.md). The printed "PLEASE HOLD FOR
-- GEOTAB INSTALLATION" pegboard list, absorbed so FG KNOWS which plates need a Geotab unit — a
-- lookup flags it instead of the operator checking the sheet (recall→knowing). Keyed by PLATE,
-- not vehicle_id: most are incoming and not in the fleet yet. installed_at stamps when it's done
-- (a car off the list); a null installed_at = still pending. RLS allow-all (FG trusted-crew).
create table if not exists public.geotab_watchlist (
  plate         text primary key,
  added_at      timestamptz not null default now(),
  installed_at  timestamptz,
  installed_by  uuid references public.profiles(id)
);

comment on table public.geotab_watchlist is
  'Plates flagged for Geotab installation (the pegboard hold-list). Lookup flags a pending plate; installed_at clears it. See api/_lib/effieExecutors executeLookup + docs/ticket-geotab-watchlist.md.';

alter table public.geotab_watchlist enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'geotab_watchlist' and policyname = 'geotab_watchlist_all'
  ) then
    create policy geotab_watchlist_all on public.geotab_watchlist for all using (true) with check (true);
  end if;
end $$;
