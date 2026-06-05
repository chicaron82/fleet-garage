-- Migration 069: optional alternate date for stat-day PTO
--
-- Booking PTO on a stat holiday isn't allowed at this branch, but FG let it happen
-- silently. A PTO shift on a stat now warns the VSA and lets them offer a backup
-- date upfront, which is surfaced in the PTO request text/PDF so the boss sees
-- "wants Jul 1 (Canada Day — stat), offering Jul 2 as a backup" in one place.
--
-- Lives on `shifts` because a PTO day is a shifts row (shift_type = 'pto'). Nullable,
-- no default — only the rare stat-day PTO sets it.

alter table shifts
  add column if not exists pto_alternate_date date;
