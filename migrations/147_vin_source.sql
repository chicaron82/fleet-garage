-- 147 — WHERE a VIN came from. The field that is a checksum finally records its own provenance.
--
-- ⚠️⚠️ THE SYMPTOM, measured 2026-09-15. `checkVehicleWatchlist` — "cars the TAG cannot settle" —
-- can only ever grow, because nothing tells it when the errand is done. Its own words are *"read the
-- barcode sticker in the door jamb"*, and when that finally happens the flag stays exactly where it
-- was. After stamping LFJ437 the list read:
--
--     728NVJ  no VIN            → real errand
--     LFJ437  6S7384010         → SETTLED (Aaron read its own door jamb, that afternoon)
--     LZM516  0T3076384         → STILL A QUESTION (VIN off a tag LZM539 also claims)
--     LZM539  no VIN            → real errand
--
-- ⭐⭐ LFJ437 and LZM516 are INDISTINGUISHABLE IN THE DATA AND OPPOSITE IN MEANING. One has nothing
-- left to check; the other is the exact car the flag was invented for. The entire difference is where
-- the VIN came from — and until now FG did not store that.
--
-- ⭐ Every other identity field already had this. `field_sources` records tag / manual / inferred /
-- derived for make, model, year, colour, rental class and unit number. The VIN — the ONE field
-- carrying its own check digit — was a bare value.
--
-- ⚠️ A SEPARATE COLUMN, NOT `field_sources`. That map is scoped to the fields a KEY TAG prints, and
-- the whole point here is that a VIN's best source is NOT the tag: a tag can be shared (the Priuses),
-- sliced (FTR2260), or handwritten with no `Last9vin:` line at all (LFJ437, DEWN854). Folding it in
-- would bury the distinction inside a shape that assumes the opposite.
--
-- ⚠️⚠️ IMMUTABILITY IS DELIBERATELY UNCHANGED. `vinWrite` still fills only a blank
-- (`.is('vin_last9', null)`). Whether a later STICKER read should overrule an earlier TAG read is a
-- real question and a separate decision — and LFJ400 is the cautionary tale about re-arming a
-- first-write-wins field: clearing the bad value did not erase it, it UNLOCKED it, and the original
-- source refilled it unchanged. Adding a column does not require answering that, so it does not.
--
-- ⚠️ NO BLIND BACKFILL. 719 VINs are already on file with no source. Stamping them all 'tag' would be
-- a guess about history and wrong for any that came off a sticker — and it would not even help, since
-- LFJ437 would land on 'tag' and stay stuck. **NULL means UNKNOWN and keeps a car ON the list**, which
-- is the conservative direction for a to-do list. Only the two rows whose provenance is actually known
-- are set, below.
--
-- RLS: inherits `vehicles`.
alter table vehicles
  add column if not exists vin_source text
    check (vin_source is null or vin_source in ('sticker','tag','inferred'));

comment on column vehicles.vin_source is
  'Where vin_last9 came from. sticker = the car''s own door-jamb label, the strongest source and the only one that SETTLES a check-vehicle flag. tag = a key tag, provisional (a tag can be shared, sliced, or handwritten with no VIN line). inferred = deduced and never read (LUR173: S17793886 transposed to 1S7793886, satisfying both the check digit and the year). NULL = unknown, which deliberately keeps a car on checkVehicleWatchlist.';

-- ⭐ The two rows whose provenance is CERTAIN, and not one more.
-- LFJ437: Aaron photographed the door jamb 2026-09-15 — KNDPUCDF6S7384010, check digit verified
-- (weighted sum 369, 369 mod 11 = 6), year character S = 2025 agreeing with the record.
update vehicles set vin_source = 'sticker'
  where license_plate = 'LFJ437' and vin_last9 = '6S7384010' and vin_source is null;

-- LZM516: read off the key tag the two Priuses share — which is precisely why it is still a question.
update vehicles set vin_source = 'tag'
  where license_plate = 'LZM516' and vin_last9 = '0T3076384' and vin_source is null;
