-- 110_rls_align_ev_loans_fuel_readings.sql
-- Two public tables (ev_asset_loans, fuel_pump_readings) shipped with RLS DISABLED while the other
-- 36 use FG's standard posture: RLS ENABLED + a permissive allow-all policy (trusted-crew PoC —
-- see project_fg_scope_boundary). Supabase's "rls_disabled_in_public" advisory flagged them.
-- This aligns them to the established pattern (mirrors airport_flips_all / "Allow all access").
--
-- NOTE: this does NOT restrict access — allow-all is the design. It removes the RLS-off deviation
-- and clears the advisory. Idempotent: enable is a no-op if already on; policies are dropped-if-exists
-- then recreated. The policy is created in the SAME migration as enabling RLS so the anon client is
-- never locked out (enabling RLS with no policy would break every read of these tables).

alter table public.ev_asset_loans      enable row level security;
alter table public.fuel_pump_readings  enable row level security;

drop policy if exists ev_asset_loans_all on public.ev_asset_loans;
create policy ev_asset_loans_all on public.ev_asset_loans
  for all to public using (true);

drop policy if exists fuel_pump_readings_all on public.fuel_pump_readings;
create policy fuel_pump_readings_all on public.fuel_pump_readings
  for all to public using (true);
