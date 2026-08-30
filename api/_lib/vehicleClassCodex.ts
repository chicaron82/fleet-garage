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
  CSLE: { make: 'Toyota', model: 'Sienna', isHybrid: true },   // every Sienna is a hybrid — Aaron, 2026-08-29
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
  CTMY: { make: 'Tesla', model: 'Model Y' }, // 6 on the fleet and absent from here until 2026-08-30 — Aaron: *"CTMY should have been [known] as its a model y tesla"*. Two of the six still read model 'Unknown'.
  CTM3: { make: 'Tesla', model: 'Model 3' },
  CM3L: { make: 'Tesla', model: 'Model 3' },
  C3US: { make: 'Tesla', model: 'Model 3' }, // 3rd Model 3 code — Aaron confirmed at the car, 2026-07-20 (unit 5515358 / LJF689, VAN DTG, rental class B9)
  // Volvo
  CX96: { make: 'Volvo', model: 'XC90' },
  C6CU: { make: 'Volvo', model: 'XC60' }, // surfaced live 2026-07-20 (Aaron, unit 5427752 / LJF700) — visually confirmed XC60
  CX4U: { make: 'Volvo', model: 'XC40' }, // surfaced live 2026-07-20 (Aaron, unit 5429683 / LUR478, rental class W4) — confirmed XC40
  CXRU: { make: 'Volvo', model: 'XC40' }, // a SECOND XC40 code, off LUR478's own tag in the 2026-08-30 audit. Aaron on why Volvos lagged: *"volvos, buicks were absent from our fleet so i didn't have them in my own memory to confidently add them."*
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
  // ⭐ NOT a duplicate of CGCL and NOT a correction of it — two codes for two ERAS. The Canadian
  // Grand Caravan became a CHRYSLER in 2021, and the one car carrying CGCT is a 2024. Aaron raised
  // the make himself and hedged it — *"CGCT a chrysler grand caravan. we may have listed it under
  // dodge instead of chrysler"* — so CGCL is left exactly as it is rather than rewritten on a
  // hunch: an older Dodge-badged van is still a Dodge.
  CGCT: { make: 'Chrysler', model: 'Grand Caravan' },
  CPCL: { make: 'Chrysler', model: 'Pacifica' },
  CDR8: { make: 'Dodge', model: 'Durango' },
  // Newer Durango class — confirmed off a real tag at the car (LUR437, unit 5429949,
  // "CDGT 26 BLA 4DR") by Aaron on the lot, 2026-07-19. Not a guess: he was standing at it.
  CDGT: { make: 'Dodge', model: 'Durango' },
  C300: { make: 'Chrysler', model: '300' },
  // Buick
  CEVS: { make: 'Buick', model: 'Envista' }, // surfaced live 2026-07-08 — didn't resolve, Aaron told Effie by hand
  CENA: { make: 'Buick', model: 'Envista' }, // a SECOND Envista code, off the tags in the 2026-08-30 audit (2 cars, both 2026)
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

/**
 * ⭐⭐⭐ MODELS THAT ARE ONLY EVER HYBRIDS. Not a code, not a class — a fact about the car.
 *
 * Aaron, 2026-08-29: *"there is no such thing as a pure ICE prius"* and, of the Siennas,
 * *"all listed as R even though they're hybrids."*
 *
 * ⚠️ WHY THIS OUTRANKS THE CODE. A key tag can be wrong and often is, and chasing a reprint is not
 * a thing that happens: *"the tag can have inaccurate info on it. there are many. not my job to
 * chase someone to have one printed out. that car needs to get rented."* So the model is the sturdier
 * evidence — it survives a mis-printed code, which is the exact case he keeps having to correct by
 * hand. His ask, verbatim: *"i want FG to know what i know. this tag reads ICE, i'm at the vehicle.
 * its a hybrid. make FG reflect the truth in front of me."*
 *
 * ⚠️⚠️ ADD A MODEL HERE ONLY WHEN IT IS TRUE OF EVERY EXAMPLE, EVER. Volvo is the counter-case and
 * the reason this list is short: *"many volvos... retain their model code/class, but are actually
 * hybrids."* **Many, not all** — so no Volvo belongs here, and its 24 unflagged cars stay his call.
 * A model in this list is FG asserting a powertrain without being asked; the bar is a fact about the
 * world, never a pattern in the fleet.
 */
const HYBRID_ONLY_MODELS: ReadonlySet<string> = new Set(['PRIUS', 'SIENNA']);

/**
 * True when the MODEL settles the powertrain by itself, undefined when it says nothing.
 *
 * ⚠️ One-way, exactly like `hybridFromRentalClass`: never `false`. A model absent from the list is
 * unknown, not petrol — most hybrids in this fleet are models that also ship as ICE.
 */
export function hybridFromModel(model: string | undefined | null): true | undefined {
  const key = (model ?? '').trim().toUpperCase();
  if (!key) return undefined;
  // Matched on the leading word so a trim survives: "Sienna LE" and "Prius Prime" both count, while
  // a different model that merely contains the word does not lead with it.
  const first = key.split(/[^A-Z0-9]+/)[0];
  return HYBRID_ONLY_MODELS.has(first) ? true : undefined;
}

/** A real model code is FOUR characters. Aaron, 2026-08-28: *"a two character code is too vague to
 *  be a real model code. i've only ever seen 4, or displayed in full."*
 *
 *  ⚠️⚠️ WHY THIS IS A GATE ON TEACHING AND NOT A VALIDATION ANYWHERE ELSE. The taught table held
 *  `CN = Nissan Sentra`, learned by FG from a TRUNCATED read of `CNSS`. It is the dangerous kind of
 *  wrong because it is nearly RIGHT: `CN` resolves to the correct make and model, so every later
 *  truncation lands cleanly, looks right, and the error never surfaces. An error that legitimises
 *  itself.
 *
 *  ⓘ CORRECTION (2026-08-28, same evening): I first wrote here that `CNSS` "was not in the codex at
 *  all, which is precisely why a short read had room to become the mapping." **That was false.**
 *  `CNSS` is curated three lines above `CSEN`, and the curated table is consulted FIRST. I had
 *  queried `vehicle_class_codex` — the 29-row TAUGHT overflow — and called it "the codex", when the
 *  codex is this 73-entry curated map plus that overflow. Measuring the smaller half and reporting
 *  it as the whole.
 *
 *  ⭐ The sharper diagnosis that replaced it: most "unknown codes" are a READ gap, not a knowledge
 *  gap — a code already in this file arriving truncated or misread, which the teach path then
 *  memorises as corruption. Aaron had been telling sessions for weeks that he had already fed FG
 *  these codes. He had. They were here the whole time.
 *
 *  ⓘ SECOND CORRECTION (2026-08-30) — AND THE SAME OVER-REACH, ONE STEP FURTHER OUT. That paragraph
 *  originally closed with "across the fleet's 80 distinct codes, the number FG does not know is
 *  **ZERO**. There is no knowledge gap." **That is false**, and Aaron said so plainly: *"FG doesn't
 *  know every single one in the fleet. most of it was taught from me. the rest needed to be learned.
 *  volvos, buicks were absent from our fleet so i didn't have them in my own memory to confidently
 *  add them."*
 *
 *  ⚠️⚠️ This map is a RECORD OF WHAT ONE PERSON HAS SEEN, not a catalogue of what exists. Its
 *  coverage tracks the fleet's history — the makes that were never on the lot were never learned,
 *  and the fleet keeps changing. So "not in the map" is genuinely ambiguous between a misread and a
 *  code nobody has met yet, and the confident version of this comment resolved that ambiguity the
 *  wrong way for anyone who read it: it says every unknown IS a misread. A comment that asserts a
 *  property of the FLEET reads as domain knowledge, so nobody re-checks it.
 *
 *  ⭐ How the over-reach happened, both times: a real finding ("CNSS was here all along") was
 *  generalised into a claim about EVERYTHING, with the evidence for the specific case doing duty
 *  for the general one. [[feedback_generalising_a_claim]]. The measured claim — most unknowns are
 *  read gaps — is the one that survives, and it is enough to justify the teach gate.
 *
 *  ⚠️ It gates only what FG LEARNS. It must never be used to judge what Aaron TYPES: plenty of tags
 *  carry no code at all and spell the model out in full (DEWN854 says SELTOS, the US Compass says
 *  COMPASS, FVB4297 says Model Y). A length rule pointed at a person warns him about tags he has
 *  read perfectly; pointed at the teach path it stops FG memorising its own misreads. */
/** Every code the CURATED map knows. Exported so the prefix resolver can ask what a partial read
 *  could have been without reaching into the map itself — the accessor keeps CODEX module-local,
 *  which is what stops a caller mutating the chart it is reading. */
export function curatedClassCodes(): readonly string[] {
  return Object.keys(CODEX);
}

/** The HYBRID variant of the same make and model, when the codex knows one. `CSPT` (Kia Sportage)
 *  → `CSEH` (Kia Sportage, hybrid). Null when there is no sibling, or when `code` IS the hybrid one.
 *
 *  Derived from CODEX by make+model rather than listed, so a pair added later is found for free. */
export function hybridSiblingFor(code: string | undefined | null): string | null {
  const key = normalizeClassCode(code);
  const self = key ? CODEX[key] : undefined;
  if (!self || self.isHybrid) return null;
  for (const [other, v] of Object.entries(CODEX)) {
    if (other === key) continue;
    if (v.isHybrid && v.make === self.make && v.model === self.model) return other;
  }
  return null;
}

/** A car whose stored identity disagrees with its own class code. */
export interface ModelCodeMismatch {
  code: string;
  /** What the codex says that code is. */
  codexMake: string;
  codexModel: string;
}

/**
 * Does this car's make/model disagree with what its own class code says?
 *
 * ⭐ MEASURED BEFORE BUILT, 2026-08-29: of 637 fleet cars checkable against the curated codex, 636
 * agree exactly. The single outlier is a Camry recorded as "Camry SE" — a trim suffix, not an error.
 * So this is not cleaning up a mess; it is keeping a clean thing clean.
 *
 * ⚠️ WHERE A DISAGREEMENT CAN STILL BE BORN. The register form derives make and model FROM the code,
 * so they agree by construction. The direct-edit modal does not: it lets a person change the make,
 * the model and the code independently, with nothing comparing them. Same hole the hybrid checkbox
 * had — *"me flipping the hybrid checkbox but forgetting to change the model code"* — one field over.
 *
 * ⚠️ Trim-tolerant, deliberately. "Camry SE" must not be flagged against "Camry": the codex names a
 * MODEL and a record may carry a trim. It fires only when the model is a genuinely different word,
 * because a warning that cries at a trim level is a warning he learns to dismiss.
 *
 * ⚠️ And it REPORTS. The tag can be mis-printed — two Sportage hybrids wear a petrol code — so a
 * disagreement is a question, never a correction.
 */
export function modelCodeMismatch(
  classCode: string | undefined | null,
  make: string | undefined | null,
  model: string | undefined | null,
): ModelCodeMismatch | null {
  const vc = lookupVehicleClass(classCode);
  if (!vc || !model?.trim()) return null;
  const norm = (v: string) => v.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const recModel = norm(model), codexModel = norm(vc.model);
  // A record may carry a trim the codex does not name ("Camry SE" vs "Camry"), and a codex model may
  // be the longer form. Either containing the other is agreement.
  const modelOk = recModel.startsWith(codexModel) || codexModel.startsWith(recModel);
  const makeOk = !make?.trim() || norm(make) === norm(vc.make);
  return modelOk && makeOk ? null : { code: normalizeClassCode(classCode), codexMake: vc.make, codexModel: vc.model };
}

/** A code→class pin that contradicts the codex, with the code that would not. */
export interface ClassPinContradiction {
  code: string;
  rentalClass: string;
  /** The code that DOES mean the hybrid variant of this model. */
  hybridCode: string;
}

/**
 * A pin that the codex says cannot be right.
 *
 * ⭐⭐ THE EXACT EVENT THIS EXISTS FOR, 2026-08-28 13:05. MCN141 and MCN144 are Sportage HYBRIDS
 * whose tags were physically printed with `CSPT`, the ICE code. Aaron corrected the car the only way
 * the form allowed — in his words, *"me flipping the hybrid checkbox but forgetting to change the
 * model code"* — and the edit pinned `CSPT → E6`.
 *
 * ⭐⭐⭐ That pin was TRUE ABOUT THE CAR IN HIS HAND and false about the eleven genuine petrol
 * Sportages. A per-car observation became a per-code rule, and because it was PINNED, no scan was
 * permitted to correct it: the wrong mapping was the locked one. The sibling defect is `CSEH → Q4`,
 * learned ten days earlier from a tag whose CLASS was mis-printed instead.
 *
 * ⚠️ The contradiction is visible without asking anyone: E6 is Hertz's powertrain-hybrid group, and
 * the codex already knows `CSPT` is the petrol Sportage and `CSEH` is the hybrid one. FG held both
 * halves and never compared them — the same shape as the tag's city and its owning number.
 */
export function classPinContradiction(
  code: string | undefined | null,
  rentalClass: string | undefined | null,
): ClassPinContradiction | null {
  const key = normalizeClassCode(code);
  const cls = (rentalClass ?? '').trim().toUpperCase();
  if (!key || !cls) return null;
  // Only the hybrid group is decidable here. E6 ⇒ hybrid; every other class says nothing about
  // powertrain, exactly as `hybridFromRentalClass` documents.
  if (hybridFromRentalClass(cls) !== true) return null;
  const entry = CODEX[key];
  if (!entry || entry.isHybrid) return null;   // unknown code, or already the hybrid variant
  const hybridCode = hybridSiblingFor(key);
  return hybridCode ? { code: key, rentalClass: cls, hybridCode } : null;
}

export function isTeachableClassCode(code: string | undefined | null): boolean {
  return normalizeClassCode(code).length === 4;
}

export function lookupVehicleClass(code: string | undefined | null): VehicleClass | null {
  const key = normalizeClassCode(code);
  return key ? (CODEX[key] ?? null) : null;
}
