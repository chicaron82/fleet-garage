-- 086: durable, cross-device quick-start order
-- The Off-Standard quick-start arrangement was localStorage-only — per-device, so
-- a reorder on the phone never reached the PC (and a blocked/cleared localStorage
-- looked saved until the next reload). Promote it to the profile row so it follows
-- the user across devices; localStorage stays as an instant cache + offline fallback.
--
-- RLS note: migration 082 left profiles client-updatable ONLY for roster_only rows
-- ("update roster staff"), so a real authed user could not write their own profile.
-- Add an owner self-update policy (id = auth.uid()) so a user can persist their own
-- quick-start order. Permissive policies are OR'd, so the roster policy is unaffected.
-- Owner-scoped, consistent with the trusted-crew posture.

-- 1. The order itself: preset ids, null = schedule-aware default.
alter table public.profiles add column if not exists quick_start_order text[];
comment on column public.profiles.quick_start_order is
  'Per-user Off-Standard quick-start preset order (preset ids); null = schedule-aware default. Mirrored to localStorage as a device cache.';

-- 2. Let a user update their own profile (the roster policy only covered roster_only rows).
drop policy if exists "Authenticated can update own profile" on public.profiles;
create policy "Authenticated can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
