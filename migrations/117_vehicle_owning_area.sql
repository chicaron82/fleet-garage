-- The OWNING AREA on a vehicle — which branch owns it (2026-08-18, from Aaron explaining what the
-- number on the key tag actually is).
--
-- Every tag carries it: `WINNIPEG / 08199  Q4` printed, `8199  B` handwritten. FG has been reading
-- that line since the scanner shipped and DISCARDING the number — the prompt said outright "report
-- the short class code — NOT the branch number". So FG could never tell a Winnipeg car from a
-- Calgary one.
--
--   8199 Winnipeg · 8191 Vancouver · 8193 Calgary · 8197 Toronto
--
-- WHY IT MATTERS OPERATIONALLY: cars get sent one-way between branches, and a low-km one may be
-- KEPT and re-plated to Manitoba. *"the unit number and owning would remain the same but then the
-- license would be changed to something like LUR999."* Three such flips are live in the fleet today
-- (5762083→LJF690, 5769674→LUR462, 5769823→LUR531 — two Chrysler Pacificas, exactly the
-- high-demand units you keep). The owning is the input to that decision and nothing recorded it.
--
-- ⚠️ TEXT, NOT AN ENUM OR A DERIVED VALUE. The tempting shortcut is inferring the branch from the
-- unit-number prefix. It is wrong twice: a flipped car keeps a foreign unit while wearing an MB
-- plate, and the numbers themselves ROTATE — when Aaron started, Winnipeg's owning was 8999 with
-- units 589xxxx/592xxxx; it is now 8199 with 542xxxx, and 549xxxx was added when the branch outgrew
-- a single prefix. A prefix table silently rots; the tag prints the truth on every scan. Store what
-- was read.
--
-- Nullable, and stays that way: every vehicle registered before today has no owning on record, and
-- backfilling one would be inventing data. It fills in as tags get scanned.
ALTER TABLE vehicles ADD COLUMN IF NOT EXISTS owning_area TEXT;

-- The query this serves: "which cars in my lot aren't ours?"
CREATE INDEX IF NOT EXISTS vehicles_owning_area_idx ON vehicles (owning_area) WHERE owning_area IS NOT NULL;
