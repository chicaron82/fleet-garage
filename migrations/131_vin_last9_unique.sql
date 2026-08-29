-- A VIN identifies exactly one car. Enforce it in the DATABASE, because every softer place has now
-- been bypassed at least once.
--
-- ⚠️ THE INCIDENT, 2026-08-29. A 158-photo VIN backfill wrote `9TR289777` onto THREE cars — a
-- Suburban, a Sentra and a Bronco Sport. The value is real (it is a Suburban's actual tag, and was
-- used as the vision prompt's sample BECAUSE it was a real read), so nothing about the string was
-- detectably wrong: nine characters, legal alphabet, legal check digit. Two of the three were
-- fabrications, and the ONLY reason anyone noticed was a duplicate check run by hand afterwards.
--
-- ⭐⭐⭐ WHY A CONSTRAINT AND NOT A GUARD. The first fix was a denylist of the documented sample
-- VINs inside the reader — correct, tested, and bypassed within the hour by a measurement script
-- that called the model directly. The second version moved it to the shared normalizer so it could
-- not be skipped, and that version was WORSE: it permanently refused two REAL VINs, one of which
-- had already been destroyed twice. A denylist of real values can only ever be wrong.
--
-- Uniqueness is the honest invariant. It rejects the second write of a VIN and says nothing about
-- the first, needs no list to maintain, and cannot be forgotten by the next caller — which no
-- function-level guard in this codebase has managed.
--
-- ⚠️ NULLs are unconstrained, deliberately: 175 cars have no VIN and must stay that way until one
-- is read. A partial index is what makes "unknown" and "duplicate" different states.
--
-- Verified before applying: zero duplicate vin_last9 values on the live fleet.
create unique index if not exists vehicles_vin_last9_unique
  on public.vehicles (vin_last9)
  where vin_last9 is not null;

comment on index public.vehicles_vin_last9_unique is
  'A VIN identifies one car. Enforced here because a backfill wrote one VIN onto three cars in Aug 2026 and only a manual duplicate check found it.';
