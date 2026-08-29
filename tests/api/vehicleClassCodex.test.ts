import { describe, it, expect } from 'vitest';
import { lookupVehicleClass, normalizeClassCode, isTeachableClassCode } from '../../api/_lib/vehicleClassCodex';

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
