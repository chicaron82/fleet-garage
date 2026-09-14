-- 145 — 'Lead CSR': the counter's lead, as a role (mirrors 'Lead VSA').
--
-- Aaron, 2026-09-14: *"since Jagdeep is a Lead CSR, have his shaded then sorted by counter than HIR"*
-- — and asked whether that should be a shading flag or a role: *"your lean, a real role"*. A flag
-- would record a LOOK; the role records a FACT. `profiles.role` is free text (no CHECK), so this is a
-- data change: the vocabulary lives in `UserRole` (src/types) and every list that names 'CSR' was swept
-- for 'Lead CSR' in the same commit.
--
-- The schedule grid shades the Lead CSR and sorts them first in the counter block — the seam between
-- drivers and counter, the same way Larry C (utility) seams floor and drivers. See lib/rosterOrder.

update public.profiles set role = 'Lead CSR'
  where name = 'Jagdeep' and role = 'CSR' and roster_only;
