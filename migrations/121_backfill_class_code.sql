-- Backfill the class code where the fleet's own data DECIDES it (2026-08-19, Aaron's call).
--
-- Migration 120 stored `class_code` and deliberately backfilled nothing, on the grounds that a code
-- reverse-guessed from make and model is a fabrication. Aaron corrected the premise: *"we can figure
-- out some from the data we already have… CCRL is only ever a corolla. if it were hybrid then CCLH."*
-- He is right — the mapping fails to invert only where more than one code shares a car, and most
-- codes are alone.
--
-- ⭐ THE RULE THIS ENCODES: **derive a code only when a field FG ACTUALLY HOLDS decides it.**
--   • make + model + hybrid unique in the curated codex  →  derivable (52 combinations)
--   • the 2026 model-year splits he named               →  derivable, because FG stores the year
--       Kicks CKSV≤2025 / CKVA 2026+ (the class moves B4→B5 too), Sentra CNSS/CSEN,
--       Durango CDR8/CDGT, Bronco Sport CFBS/CBOB
--   • Versa CVSS vs CVRS                                →  NEVER. The split is IGNITION —
--       turn-key against push-button — and FG records no such field. The discriminator exists on
--       the car and nowhere in the record, so those rows stay NULL forever.
--   • Rogue, Explorer, Model 3                          →  NEVER (yet). Real doubles whose rule
--       nobody has named. An unnamed rule is a guess wearing a table.
--
-- ⚠️ EVERY ROW IS STAMPED `field_sources.classCode = 'derived'`, and that stamp is load-bearing:
-- `classCodeWrite` refuses to overwrite a stored code, so without it a DEDUCTION would permanently
-- block the TRUTH — a real tag read could never correct a backfilled guess. With it, the scan path
-- treats a derived code as provisional and a tag read upgrades it. **The backfill is a placeholder
-- that yields to evidence.**
--
-- Only touches rows where class_code IS NULL. Every change is captured from→to by the vehicle change
-- trail (migration 118), so the whole thing is reversible.

WITH codex(make, model, is_hybrid, year_cut, code_old, code_new) AS (VALUES
    ('buick','envista',false,NULL,NULL,'CEVS'),
    ('chevrolet','equinox',false,NULL,NULL,'CQRS'),
    ('chevrolet','malibu',false,NULL,NULL,'CMBU'),
    ('chevrolet','malibu lt',false,NULL,NULL,'CMLT'),
    ('chevrolet','suburban',false,NULL,NULL,'CSBZ'),
    ('chevrolet','trailblazer',false,NULL,NULL,'CTAV'),
    ('chevrolet','traverse',false,NULL,NULL,'CTLT'),
    ('chevrolet','trax',false,NULL,NULL,'CTXF'),
    ('chrysler','300',false,NULL,NULL,'C300'),
    ('chrysler','pacifica',false,NULL,NULL,'CPCL'),
    ('dodge','grand caravan',false,NULL,NULL,'CGCL'),
    ('ford','bronco',false,NULL,NULL,'CFBO'),
    ('ford','edge',false,NULL,NULL,'CEDG'),
    ('ford','escape',false,NULL,NULL,'CUES'),
    ('ford','expedition',false,NULL,NULL,'CXPD'),
    ('ford','f-150',false,NULL,NULL,'CF1X'),
    ('gmc','acadia',false,NULL,NULL,'CALE'),
    ('hyundai','elantra',false,NULL,NULL,'CELA'),
    ('hyundai','kona',false,NULL,NULL,'CKOP'),
    ('hyundai','palisade',false,NULL,NULL,'CHPP'),
    ('hyundai','tucson',false,NULL,NULL,'CTAP'),
    ('hyundai','venue',false,NULL,NULL,'CHVP'),
    ('jeep','wrangler',false,NULL,NULL,'CWUR'),
    ('kia','carnival',false,NULL,NULL,'CCVL'),
    ('kia','forte',false,NULL,NULL,'CFEX'),
    ('kia','k4',false,NULL,NULL,'CK4L'),
    ('kia','niro ev',false,NULL,NULL,'CKNE'),
    ('kia','seltos',false,NULL,NULL,'CKSE'),
    ('kia','sorento',false,NULL,NULL,'CSOR'),
    ('kia','soul',false,NULL,NULL,'CSOL'),
    ('kia','sportage',false,NULL,NULL,'CSPT'),
    ('kia','sportage',true,NULL,NULL,'CSEH'),
    ('mazda','cx-5',false,NULL,NULL,'CC5S'),
    ('nissan','altima',false,NULL,NULL,'CALA'),
    ('nissan','pathfinder',false,NULL,NULL,'CPT4'),
    ('toyota','camry',false,NULL,NULL,'CCAM'),
    ('toyota','camry',true,NULL,NULL,'CCMH'),
    ('toyota','camry se',false,NULL,NULL,'CCSE'),
    ('toyota','corolla',false,NULL,NULL,'CCRL'),
    ('toyota','corolla',true,NULL,NULL,'CCLH'),
    ('toyota','corolla cross',false,NULL,NULL,'CCRC'),
    ('toyota','corolla hatchback',false,NULL,NULL,'CCRH'),
    ('toyota','rav4',false,NULL,NULL,'CRVB'),
    ('toyota','rav4',true,NULL,NULL,'CRHX'),
    ('toyota','sienna',false,NULL,NULL,'CSLE'),
    ('volkswagen','atlas',false,NULL,NULL,'CATL'),
    ('volkswagen','jetta',false,NULL,NULL,'CJCL'),
    ('volkswagen','taos',false,NULL,NULL,'CTVA'),
    ('volkswagen','tiguan',false,NULL,NULL,'CTCF'),
    ('volvo','xc40',false,NULL,NULL,'CX4U'),
    ('volvo','xc60',false,NULL,NULL,'C6CU'),
    ('volvo','xc90',false,NULL,NULL,'CX96'),
    ('nissan','kicks',false,2025,'CKSV','CKVA'),
    ('nissan','sentra',false,2025,'CNSS','CSEN'),
    ('dodge','durango',false,2025,'CDR8','CDGT'),
    ('ford','bronco sport',false,2025,'CFBS','CBOB')
)
UPDATE vehicles v
   SET class_code = CASE
         WHEN c.year_cut IS NULL              THEN c.code_new
         WHEN COALESCE(v.year,0) <= c.year_cut THEN c.code_old
         ELSE c.code_new
       END,
       field_sources = COALESCE(v.field_sources, '{}'::jsonb) || '{"classCode":"derived"}'::jsonb
  FROM codex c
 WHERE v.archived_at IS NULL
   AND v.class_code IS NULL
   AND lower(v.make)  = c.make
   AND lower(v.model) = c.model
   AND COALESCE(v.is_hybrid, false) = c.is_hybrid
   -- A year-split row can only decide a car whose year FG actually knows.
   AND (c.year_cut IS NULL OR COALESCE(v.year,0) > 0);
