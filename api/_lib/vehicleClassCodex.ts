// YWG Hertz class-code → make/model lookup for the key-tag scan. A tag prints a class
// code (e.g. "CCVL 25") instead of the make/model; this maps it so the assistant can
// fill a registration from a photo. Mirrors docs/May/ywg-vehicle-codex.md (the living
// source of truth) — committed here because the proxy can't read the gitignored doc at
// runtime. When a new code surfaces on a tag, add it HERE and in the doc; an unknown code
// returns null and the assistant asks for make/model instead of guessing.
//
// THIS FILE IS THE ONLY CODEX IN THE CODEBASE. A second copy lived at
// src/data/ywgVehicleCodex.ts with zero importers and silently drifted out of sync (4 codes
// missing, CM3L disagreeing) until a mis-filed CKVA exposed it on 2026-07-19 — deleted in
// cc50536's follow-up. Client code imports from api/_lib directly (see platePrefix); do NOT
// mirror this table again.
//
// The model/year on the tag are read separately (year follows the code, e.g. "25" →
// 2025); this map is class → make + model only. Variant notes and years from the doc
// are stripped to a clean model name.

export interface VehicleClass {
  make: string;
  model: string;
  /** Hybrid is a flag on the vehicle now, not a "<Base> Hybrid" model (migration 109). A tag whose
   *  class code is a hybrid variant resolves to the BASE model + this hint, so the model stays
   *  selectable in the catalogue AND the hybrid signal survives the scan. */
  isHybrid?: boolean;
  /** Battery-EV → the flip logs a charge % instead of a gas level. UNLIKE isHybrid, EV models are
   *  distinctly named (Niro EV, not Niro), so EV-ness is derivable from the model — no per-vehicle
   *  flag / migration needed. Tesla is covered separately by make (isTeslaMake). */
  isEv?: boolean;
}

const CODEX: Record<string, VehicleClass> = {
  // Toyota
  CCAM: { make: 'Toyota', model: 'Camry' },
  CCSE: { make: 'Toyota', model: 'Camry SE' },
  CCMH: { make: 'Toyota', model: 'Camry', isHybrid: true },
  CCRL: { make: 'Toyota', model: 'Corolla' },
  CCRC: { make: 'Toyota', model: 'Corolla Cross' },
  CCRH: { make: 'Toyota', model: 'Corolla Hatchback' },
  CCLH: { make: 'Toyota', model: 'Corolla', isHybrid: true },
  // Surfaced live 2026-08-28 on two cars (LUR433, FVJ1788) that had both registered as NON-hybrid
  // because no codex entry existed to pre-check the toggle. The Prius is hybrid-only.
  CPHE: { make: 'Toyota', model: 'Prius', isHybrid: true },
  CRVB: { make: 'Toyota', model: 'RAV4' },
  CRHX: { make: 'Toyota', model: 'RAV4', isHybrid: true }, // surfaced live 2026-07-22 (Aaron, keytag photo) —
  // the boss's #1 poach target. Tag prints correct CRHX but the rental class is mislabeled Q4 (gas
  // RAV4's class); the real class is E6 (powertrain-hybrid group, per the Hertz chart he photographed
  // 2026-07-20). First live test of the field-provenance ladder shipped same session (8a60f43).
  CSLE: { make: 'Toyota', model: 'Sienna' },
  // Hyundai
  CELA: { make: 'Hyundai', model: 'Elantra' },
  CHVP: { make: 'Hyundai', model: 'Venue' },
  CKOP: { make: 'Hyundai', model: 'Kona' },
  CHPP: { make: 'Hyundai', model: 'Palisade' },
  CTAP: { make: 'Hyundai', model: 'Tucson' },
  // Kia
  CKSE: { make: 'Kia', model: 'Seltos' },
  CKNE: { make: 'Kia', model: 'Niro EV', isEv: true },
  CCVL: { make: 'Kia', model: 'Carnival' },
  CFEX: { make: 'Kia', model: 'Forte' },
  CK4L: { make: 'Kia', model: 'K4' },
  CSOR: { make: 'Kia', model: 'Sorento' },
  CSOL: { make: 'Kia', model: 'Soul' },
  CSPT: { make: 'Kia', model: 'Sportage' },
  CSEH: { make: 'Kia', model: 'Sportage', isHybrid: true },
  // Nissan
  CKSV: { make: 'Nissan', model: 'Kicks' },
  // Kicks is a NISSAN. CKVA sat in the Kia block and shipped 2 vehicles as "Kia Kicks"
  // (LUR331, LUR358 — found live on the lot 2026-07-19, both corrected in the DB).
  CKVA: { make: 'Nissan', model: 'Kicks' },
  CVSS: { make: 'Nissan', model: 'Versa' },
  CVRS: { make: 'Nissan', model: 'Versa' },
  CNSS: { make: 'Nissan', model: 'Sentra' },
  CSEN: { make: 'Nissan', model: 'Sentra' },
  CRSV: { make: 'Nissan', model: 'Rogue' },
  CROG: { make: 'Nissan', model: 'Rogue' },
  CALA: { make: 'Nissan', model: 'Altima' },
  CPT4: { make: 'Nissan', model: 'Pathfinder' },
  // Ford
  CUES: { make: 'Ford', model: 'Escape' },
  CEDG: { make: 'Ford', model: 'Edge' },
  CF1X: { make: 'Ford', model: 'F-150' },
  CXPX: { make: 'Ford', model: 'Explorer' },
  CELT: { make: 'Ford', model: 'Explorer' },
  CEST: { make: 'Ford', model: 'Explorer' },
  CFBS: { make: 'Ford', model: 'Bronco Sport' },
  CBOB: { make: 'Ford', model: 'Bronco Sport' },
  CFBO: { make: 'Ford', model: 'Bronco' },
  CXPD: { make: 'Ford', model: 'Expedition' },
  // Chevrolet
  CTXF: { make: 'Chevrolet', model: 'Trax' },
  CQRS: { make: 'Chevrolet', model: 'Equinox' },
  CMBU: { make: 'Chevrolet', model: 'Malibu' },
  CMLT: { make: 'Chevrolet', model: 'Malibu LT' },
  CTAV: { make: 'Chevrolet', model: 'Trailblazer' },
  CTLT: { make: 'Chevrolet', model: 'Traverse' }, // surfaced live 2026-07-17 (Aaron) — L2 class
  CSBZ: { make: 'Chevrolet', model: 'Suburban' }, // surfaced live 2026-07-20 (Aaron, unit 5426945 / LUR375, rental class T6) — full-size SUV, T6 shares with Expedition
  // Tesla
  CTM3: { make: 'Tesla', model: 'Model 3' },
  CM3L: { make: 'Tesla', model: 'Model 3' },
  C3US: { make: 'Tesla', model: 'Model 3' }, // 3rd Model 3 code — Aaron confirmed at the car, 2026-07-20 (unit 5515358 / LJF689, VAN DTG, rental class B9)
  // Volvo
  CX96: { make: 'Volvo', model: 'XC90' },
  C6CU: { make: 'Volvo', model: 'XC60' }, // surfaced live 2026-07-20 (Aaron, unit 5427752 / LJF700) — visually confirmed XC60
  CX4U: { make: 'Volvo', model: 'XC40' }, // surfaced live 2026-07-20 (Aaron, unit 5429683 / LUR478, rental class W4) — confirmed XC40
  // Mazda
  CC5S: { make: 'Mazda', model: 'CX-5' },
  // Volkswagen
  CJCL: { make: 'Volkswagen', model: 'Jetta' },
  // ⚠️ CVTA, not CTVA. The curated entry carried a transposition until 2026-08-21, and migration
  // 121 propagated it onto 25 vehicles by inverting make+model through it — a backfill copies the
  // authority it derived from, errors included.
  //
  // ⭐ CTVA DOES NOT EXIST — Aaron, 2026-08-21: *"ctva does not exist. it was a typo"*, confirming
  // four physical tags that all read CVTA (LUR184, LFJ390, DEWJ042, and MCN122 which already held
  // CVTA stamped from a live scan). Not "unverified", not "probably" — settled by the man who
  // built this table. Don't re-add it.
  CVTA: { make: 'Volkswagen', model: 'Taos' },
  CATL: { make: 'Volkswagen', model: 'Atlas' },
  CTCF: { make: 'Volkswagen', model: 'Tiguan' }, // surfaced live 2026-07-20 (Aaron, unit 5429832 / LUR466, rental class Q4) — rare on the lot, confirmed Tiguan
  // Chrysler / Dodge
  CGCL: { make: 'Dodge', model: 'Grand Caravan' },
  CPCL: { make: 'Chrysler', model: 'Pacifica' },
  CDR8: { make: 'Dodge', model: 'Durango' },
  // Newer Durango class — confirmed off a real tag at the car (LUR437, unit 5429949,
  // "CDGT 26 BLA 4DR") by Aaron on the lot, 2026-07-19. Not a guess: he was standing at it.
  CDGT: { make: 'Dodge', model: 'Durango' },
  C300: { make: 'Chrysler', model: '300' },
  // Buick
  CEVS: { make: 'Buick', model: 'Envista' }, // surfaced live 2026-07-08 — didn't resolve, Aaron told Effie by hand
  CGXA: { make: 'Buick', model: 'Encore' }, // surfaced live 2026-07-20 (Aaron, unit 5427851 / LUR575, rental class B5) — confirmed Encore
  CEGX: { make: 'Buick', model: 'Encore' }, // older Encore code — Aaron, 2026-07-20 (same model, earlier code)
  // GMC
  CALE: { make: 'GMC', model: 'Acadia' }, // surfaced live 2026-07-17 — Aaron flagged the gap (a CALE tag couldn't resolve → Effie had to ask)
  // Jeep
  CWUR: { make: 'Jeep', model: 'Wrangler' }, // surfaced live 2026-07-20 (Aaron, unit 5427331 / LUR573, rental class V) — the boss's "V class"; LUR573 was on his dirties list
};

/** Resolve a Hertz class code (e.g. "CCVL", "ccvl 25") to its make/model, or null. */
/** The one place a class code is normalised. Tags print "CCVL 25" / "ccvl" / " CCVL " — the code
 *  is the leading token. Shared because the lookup, the unknown-code log, the teach-back and the
 *  register hand-off must all key on the SAME string, or a code gets taught under one spelling and
 *  looked up under another (caught by a test, 2026-07-22). */
/** Every mapping, for the contract test that pins the codex to the register form's catalogue —
 *  a code that resolves to a model the dropdown can't offer strands the operator mid-registration. */
export const CODEX_ENTRIES = Object.entries(CODEX);

// Battery-EV models (charge %, not gas fuel), derived from the codex `isEv` marks — a single source
// of truth, so marking a code EV is all it takes. Tesla is handled separately by make (isTeslaMake).
const EV_MODELS: ReadonlySet<string> = new Set(
  Object.values(CODEX).filter(c => c.isEv).map(c => c.model.toLowerCase()),
);
/** True when a model is a battery-EV — used by the airport flip to show a charge % gauge. */
export function isEvModel(model: string | undefined | null): boolean {
  return !!model && EV_MODELS.has(model.trim().toLowerCase());
}

/**
 * The rental classes that are hybrid-only groups. **E6 is Hertz's powertrain-hybrid group** — every
 * one of the 40 E6 cars in the fleet is a hybrid, zero exceptions.
 *
 * ⭐ WHY THIS EXISTS, when the codex already carries `isHybrid`. The codex hint only fires for a
 * class code it KNOWS, and four cars proved that insufficient on 2026-08-28:
 *
 *   - Two 2026 Priuses on `CPHE` — a code the codex had never seen, so no hint, so the register
 *     form defaulted the toggle off and both went in as non-hybrids.
 *   - Two 2026 Sportage hybrids whose tags were printed with `CSPT`, the **ICE** Sportage code.
 *     No codex entry can ever fix those: the code on the tag is simply wrong.
 *
 * Both mis-printed tags still carried the RIGHT rental class. Aaron on the tag mismatches: *"usually
 * just laziness... it's not important. what's important to me is having FG be truthful on what type
 * of vehicle it is."* Reading the rental class routes around the wrong code entirely — the tag was
 * truthful the whole time, FG was reading the wrong field.
 *
 * ⚠️ RETURNS `true` OR `undefined` — **never `false`.** Not-E6 does not mean not-hybrid: large and
 * premium hybrids keep their segment class (Aaron: *"that sienna, stays an R but hybrid is checked;
 * several Volvo's are hybrids but keep whatever class they are"*). This is a one-way hint that fires
 * or stays silent, so it can pre-check the toggle but can never un-check it.
 */
const HYBRID_RENTAL_CLASSES: ReadonlySet<string> = new Set(['E6']);

export function hybridFromRentalClass(rentalClass: string | undefined | null): true | undefined {
  if (!rentalClass) return undefined;
  return HYBRID_RENTAL_CLASSES.has(rentalClass.trim().toUpperCase()) ? true : undefined;
}

export function normalizeClassCode(code: string | undefined | null): string {
  return (code ?? '').trim().toUpperCase().split(/\s+/)[0] ?? '';
}

/** A real model code is FOUR characters. Aaron, 2026-08-28: *"a two character code is too vague to
 *  be a real model code. i've only ever seen 4, or displayed in full."*
 *
 *  ⚠️⚠️ WHY THIS IS A GATE ON TEACHING AND NOT A VALIDATION ANYWHERE ELSE. The codex held `CN =
 *  Nissan Sentra` — taught by FG itself from a TRUNCATED read of `CNSS`. Thirteen Sentras carry
 *  CNSS; zero carry CN; CNSS was not in the codex at all, which is precisely why a short read had
 *  room to become the mapping. And it is the dangerous kind of wrong: `CN` resolves to the CORRECT
 *  make and model, so every later truncation lands cleanly, looks right, and the error never
 *  surfaces. **An error that legitimises itself.**
 *
 *  ⚠️ It gates only what FG LEARNS. It must never be used to judge what Aaron TYPES: plenty of tags
 *  carry no code at all and spell the model out in full (DEWN854 says SELTOS, the US Compass says
 *  COMPASS, FVB4297 says Model Y). A length rule pointed at a person warns him about tags he has
 *  read perfectly; pointed at the teach path it stops FG memorising its own misreads. */
export function isTeachableClassCode(code: string | undefined | null): boolean {
  return normalizeClassCode(code).length === 4;
}

export function lookupVehicleClass(code: string | undefined | null): VehicleClass | null {
  const key = normalizeClassCode(code);
  return key ? (CODEX[key] ?? null) : null;
}
