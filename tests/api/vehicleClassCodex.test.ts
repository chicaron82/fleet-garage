import { describe, it, expect } from 'vitest';
import { lookupVehicleClass, normalizeClassCode, isTeachableClassCode, hybridSiblingFor, classPinContradiction, modelCodeMismatch, hybridFromModel } from '../../api/_lib/vehicleClassCodex';

describe('curated codex — codes must match what the tags actually print', () => {
  it('⭐ CVTA is the Volkswagen Taos code, and CTVA is not a code at all', () => {
    // 2026-08-21: the curated entry carried a transposition, and migration 121 propagated it onto
    // 25 vehicles by inverting make+model through it. Four physical tags read CVTA — LUR184,
    // LFJ390, DEWJ042 and MCN122 — and none read CTVA. Aaron settled it outright: "ctva does not
    // exist. it was a typo". This assertion is the guard against it being re-added.
    expect(lookupVehicleClass('CVTA')).toEqual({ make: 'Volkswagen', model: 'Taos' });
    expect(lookupVehicleClass('CTVA')).toBeNull();
  });

  it('resolves the other codes verified off physical tags this week', () => {
    expect(lookupVehicleClass('CKSE')).toMatchObject({ make: 'Kia', model: 'Seltos' });
    expect(lookupVehicleClass('CALE')).toMatchObject({ make: 'GMC', model: 'Acadia' });
    expect(lookupVehicleClass('CCRL')).toMatchObject({ make: 'Toyota', model: 'Corolla' });
    expect(lookupVehicleClass('CCLH')).toMatchObject({ make: 'Toyota', model: 'Corolla', isHybrid: true });
  });

  it('⭐ an unknown code returns null rather than a guess', () => {
    // The safe direction: a genuine CTVA (or any unseen code) logs as unknown and Aaron decides,
    // instead of silently resolving to whatever looks close.
    expect(lookupVehicleClass('ZZZZ')).toBeNull();
    expect(lookupVehicleClass('')).toBeNull();
  });

  it('normalizes case and whitespace before looking up', () => {
    expect(normalizeClassCode(' cvta ')).toBe('CVTA');
    expect(lookupVehicleClass(normalizeClassCode(' cvta '))).toMatchObject({ model: 'Taos' });
  });
});

describe('isTeachableClassCode — what FG is allowed to LEARN', () => {
  // ⭐ THE ROW THIS EXISTS FOR. The codex held `CN = Nissan Sentra`, taught by FG from a TRUNCATED
  // read of `CNSS`. Thirteen Sentras carry CNSS; zero carry CN; CNSS was absent from the codex
  // entirely, which is exactly why the short read had room to become the mapping. And it resolved
  // to the CORRECT make and model — so every later truncation landed cleanly, looked right, and
  // the error never surfaced. An error that legitimises itself.
  it('⭐ refuses a truncated code, however plausible its mapping', () => {
    expect(isTeachableClassCode('CN')).toBe(false);
    expect(isTeachableClassCode('C')).toBe(false);
    expect(isTeachableClassCode('CNS')).toBe(false);
  });

  it('accepts the real four-character shapes the fleet actually carries', () => {
    for (const code of ['CNSS', 'CRVB', 'CTMY', 'C3UL', 'CK45', 'CX30', 'C98R']) {
      expect(isTeachableClassCode(code), `${code} should be teachable`).toBe(true);
    }
  });

  it('⚠️ refuses a spelled-out model name — that is a NAME, not a code', () => {
    // DEWN854 is handwritten and says SELTOS; the US Compass says COMPASS; FVB4297 says Model Y.
    // Those tags carry no code at all, and FG must not memorise the word as one.
    expect(isTeachableClassCode('SELTOS')).toBe(false);
    expect(isTeachableClassCode('COMPASS')).toBe(false);
  });

  it('normalizes before measuring, so case and padding cannot smuggle a bad length through', () => {
    expect(isTeachableClassCode('  cnss  ')).toBe(true);
    expect(isTeachableClassCode('  cn  ')).toBe(false);
  });

  it('refuses empty and absent input', () => {
    expect(isTeachableClassCode('')).toBe(false);
    expect(isTeachableClassCode(null)).toBe(false);
    expect(isTeachableClassCode(undefined)).toBe(false);
  });
});

describe('hybridSiblingFor / classPinContradiction — the pin that locked a mistake', () => {
  // ⭐ THE EVENT, 2026-08-28 13:05. MCN141 and MCN144 are Sportage HYBRIDS whose tags were printed
  // with CSPT, the ICE code. Aaron corrected the car the only way the form allowed — "me flipping
  // the hybrid checkbox but forgetting to change the model code" — and the edit pinned CSPT → E6.
  // True of the car in his hand. False of the eleven genuine petrol Sportages. And PINNED, so no
  // scan was permitted to undo it: the wrong mapping was the locked one.
  it('⭐ finds the hybrid sibling of a petrol code', () => {
    expect(hybridSiblingFor('CSPT')).toBe('CSEH');
  });

  it('returns null for the hybrid code itself — it has no hybrid sibling', () => {
    expect(hybridSiblingFor('CSEH')).toBeNull();
  });

  it('returns null for a model with no hybrid variant, and for an unknown code', () => {
    expect(hybridSiblingFor('CSOL')).toBeNull();
    expect(hybridSiblingFor('ZZZZ')).toBeNull();
    expect(hybridSiblingFor('')).toBeNull();
  });

  it('⭐⭐ flags CSPT + E6 — the exact pin that shipped a locked error', () => {
    const c = classPinContradiction('CSPT', 'E6');
    expect(c).toEqual({ code: 'CSPT', rentalClass: 'E6', hybridCode: 'CSEH' });
  });

  it('does NOT flag the correct pairing', () => {
    expect(classPinContradiction('CSEH', 'E6')).toBeNull();
    expect(classPinContradiction('CSPT', 'Q4')).toBeNull();
  });

  it('⚠️ only E6 decides — every other class says nothing about powertrain', () => {
    // hybridFromRentalClass is one-way by design: a premium hybrid keeps its segment class, so
    // "not E6" can never mean "not hybrid" and must never produce a contradiction.
    expect(classPinContradiction('CSPT', 'R')).toBeNull();
    expect(classPinContradiction('CSPT', 'B5')).toBeNull();
  });

  it('⚠️ says nothing about a code the codex does not know — silence, not accusation', () => {
    expect(classPinContradiction('ZZZZ', 'E6')).toBeNull();
  });

  it('says nothing when either half is missing', () => {
    expect(classPinContradiction('CSPT', '')).toBeNull();
    expect(classPinContradiction('', 'E6')).toBeNull();
    expect(classPinContradiction(null, null)).toBeNull();
  });

  it('normalizes before deciding, as every other codex entry point does', () => {
    expect(classPinContradiction('  cspt 25 ', ' e6 ')).toMatchObject({ hybridCode: 'CSEH' });
  });
});

describe('modelCodeMismatch — a record disagreeing with its own code', () => {
  // ⭐ MEASURED BEFORE BUILT, 2026-08-29: of 637 fleet cars checkable against the curated codex, 636
  // agree exactly. The single outlier was a Camry recorded as "Camry SE" — a trim suffix, not an
  // error — which is why this is trim-tolerant. It keeps a clean thing clean; the register form
  // derives make/model FROM the code, but the direct-edit modal lets all three drift apart.

  it('⭐ flags a record whose model is a different car from its code', () => {
    const m = modelCodeMismatch('CSPT', 'Kia', 'Seltos');   // CSPT is the Sportage code
    expect(m).toMatchObject({ code: 'CSPT', codexMake: 'Kia', codexModel: 'Sportage' });
  });

  it('flags a make that does not belong to the code', () => {
    expect(modelCodeMismatch('CRVB', 'Honda', 'RAV4')).toBeTruthy();
  });

  it('⚠️ TOLERATES A TRIM — "Camry SE" is not a disagreement with "Camry"', () => {
    // The live outlier. A warning that cries at trim level is one he learns to dismiss.
    expect(modelCodeMismatch('CCMH', 'Toyota', 'Camry SE')).toBeNull();
    expect(modelCodeMismatch('CCMH', 'Toyota', 'Camry')).toBeNull();
  });

  it('says nothing when the code is one the codex does not know', () => {
    expect(modelCodeMismatch('ZZZZ', 'Kia', 'Seltos')).toBeNull();
  });

  it('says nothing when there is no model to compare — a gap is not a conflict', () => {
    expect(modelCodeMismatch('CRVB', 'Toyota', '')).toBeNull();
    expect(modelCodeMismatch('CRVB', '', 'RAV4')).toBeNull();   // no make → model alone decides
    expect(modelCodeMismatch(null, null, null)).toBeNull();
  });

  it('is case- and punctuation-insensitive, as the fleet actually stores names', () => {
    expect(modelCodeMismatch('CX30', 'Mazda', 'cx-30')).toBeNull();
    expect(modelCodeMismatch('CTMY', 'Tesla', 'model y')).toBeNull();
  });
});

describe('hybridFromModel — models that are only ever hybrids', () => {
  // ⭐ Aaron, 2026-08-29: "there is no such thing as a pure ICE prius" and, of the Siennas, "all
  // listed as R even though they're hybrids." Not a pattern in the fleet — a fact about the car.
  it('⭐ settles a Prius and a Sienna without a code or a class', () => {
    expect(hybridFromModel('Prius')).toBe(true);
    expect(hybridFromModel('Sienna')).toBe(true);
  });

  it('⭐ survives a trim, because a record carries model + trim', () => {
    expect(hybridFromModel('Prius Prime')).toBe(true);
    expect(hybridFromModel('Sienna LE')).toBe(true);
  });

  it('⚠️⚠️ says NOTHING about a Volvo — "many volvos... are actually hybrids" is MANY, not all', () => {
    // 24 Volvos on the fleet, none flagged, and he says many of them are. A rule here would be FG
    // asserting a powertrain from a pattern rather than a fact. Those stay his call.
    for (const m of ['XC40', 'XC60', 'XC90']) expect(hybridFromModel(m), m).toBeUndefined();
  });

  it('⚠️ one-way, exactly like the rental-class hint — never false', () => {
    // A model absent from the list is UNKNOWN, not petrol: most hybrids here are models that also
    // ship as ICE.
    expect(hybridFromModel('Corolla')).toBeUndefined();
    expect(hybridFromModel('')).toBeUndefined();
    expect(hybridFromModel(null)).toBeUndefined();
  });

  it('⚠️ matches the LEADING word, so a different model merely containing it does not count', () => {
    expect(hybridFromModel('Grand Sienna Something')).toBeUndefined();
  });

  it('is case- and space-insensitive', () => {
    expect(hybridFromModel('  prius  ')).toBe(true);
  });

  it('⭐ the Sienna code now carries the flag too, so a scan pre-checks it', () => {
    expect(lookupVehicleClass('CSLE')?.isHybrid).toBe(true);
  });
});

// ⭐ THE FOUR CODES THE 2026-08-30 AUDIT SURFACED — and the reason they were missing, which is the
// part worth locking down. Aaron: *"FG doesn't know every single one in the fleet. most of it was
// taught from me. the rest needed to be learned. volvos, buicks were absent from our fleet so i
// didn't have them in my own memory to confidently add them."*
//
// ⚠️ That corrects a claim this map's own header used to make — "the number FG does not know is
// ZERO. There is no knowledge gap." The map is a record of what ONE PERSON has seen, and its
// coverage tracks the fleet's history. Codes will keep arriving that are new rather than misread.
describe('codes learned from the 2026-08-30 key-tag audit', () => {
  it('CTMY resolves to a Model Y — six on the fleet, absent from the map until then', () => {
    expect(lookupVehicleClass('CTMY')).toEqual({ make: 'Tesla', model: 'Model Y' });
  });

  // ⚠️ SECOND codes for models already here, not corrections of the first. Same pattern as the
  // three Model 3 codes — one model can be printed under more than one code.
  it('CXRU is a second XC40 code, alongside CX4U', () => {
    expect(lookupVehicleClass('CXRU')).toEqual({ make: 'Volvo', model: 'XC40' });
    expect(lookupVehicleClass('CX4U')).toEqual({ make: 'Volvo', model: 'XC40' });
  });

  it('CENA is a second Envista code, alongside CEVS', () => {
    expect(lookupVehicleClass('CENA')).toEqual({ make: 'Buick', model: 'Envista' });
    expect(lookupVehicleClass('CEVS')).toEqual({ make: 'Buick', model: 'Envista' });
  });

  // ⚠️⚠️ TWO ERAS, NOT A MISTAKE. The Canadian Grand Caravan became a CHRYSLER in 2021 and the one
  // car carrying CGCT is a 2024. Aaron raised the make and hedged it — *"we may have listed it under
  // dodge instead of chrysler"* — so CGCL stays Dodge rather than being rewritten on a hunch.
  it('⚠️ CGCT is a Chrysler and CGCL stays a Dodge', () => {
    expect(lookupVehicleClass('CGCT')).toEqual({ make: 'Chrysler', model: 'Grand Caravan' });
    expect(lookupVehicleClass('CGCL')).toEqual({ make: 'Dodge', model: 'Grand Caravan' });
  });
});
