import { describe, it, expect } from 'vitest';
import { matchByUnitNumber, normalizeUnit, matchedByUnitLabel, matchedByClippedTagLabel, isPlateMismatch } from '../../src/lib/matchByUnitNumber';
import type { Vehicle } from '../../src/types';

const car = (o: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', unitNumber: '5424940', licensePlate: 'LUR249',
  make: 'Volkswagen', model: 'Taos', year: 2025, color: 'Black',
  status: 'CLEAR', branchId: 'YWG',
  ...o,
} as Vehicle);

describe('normalizeUnit', () => {
  it('⭐ strips the spacing the TAG prints — "542 4940" is how it reads, 5424940 is how FG stores it', () => {
    expect(normalizeUnit('542 4940')).toBe('5424940');
  });

  it('survives nulls and junk rather than throwing', () => {
    expect(normalizeUnit(null)).toBe('');
    expect(normalizeUnit(undefined)).toBe('');
    expect(normalizeUnit('  ')).toBe('');
  });
});

describe('matchByUnitNumber', () => {
  it('⭐ identifies the car from the unit alone — the crumpled-tag case', () => {
    // Aaron's tag: plate and model torn away, "Veh #: 542 4940" still crisp.
    const m = matchByUnitNumber('542 4940', [car(), car({ id: 'other', unitNumber: '9999999' })]);
    expect(m.kind).toBe('one');
    if (m.kind === 'one') expect(m.vehicle.licensePlate).toBe('LUR249');
  });

  it('⭐ refuses to guess when two live cars share the unit', () => {
    // Three such pairs exist in the live fleet (5427497, 5738117, 5421656) — a unit gets
    // reassigned and the old row isn't archived. Guessing here would attach the scan to the
    // wrong car, which is the wrong-provenance class of bug this app keeps having to avoid.
    const m = matchByUnitNumber('5427497', [
      car({ id: 'a', unitNumber: '5427497', licensePlate: 'AAA111' }),
      car({ id: 'b', unitNumber: '5427497', licensePlate: 'BBB222' }),
    ]);
    expect(m.kind).toBe('ambiguous');
    if (m.kind === 'ambiguous') expect(m.vehicles).toHaveLength(2);
  });

  it('returns none for an unknown unit, and for no unit at all', () => {
    expect(matchByUnitNumber('1234567', [car()]).kind).toBe('none');
    expect(matchByUnitNumber('', [car()]).kind).toBe('none');
    expect(matchByUnitNumber(null, [car()]).kind).toBe('none');
  });

  it('⭐ does NOT match a vehicle whose own unit is blank against an empty read', () => {
    // 39 live vehicles have no unit number. An empty-matches-empty bug would resolve every
    // plateless scan onto whichever of those happened to sort first.
    expect(matchByUnitNumber('', [car({ unitNumber: null })]).kind).toBe('none');
    expect(matchByUnitNumber('5424940', [car({ unitNumber: null })]).kind).toBe('none');
  });
});

describe('matchedByUnitLabel', () => {
  it('says which key did the work, and why the plate did not', () => {
    expect(matchedByUnitLabel(true, '542 4940')).toContain('5424940');
    expect(matchedByUnitLabel(true, '542 4940')).toMatch(/plate/i);
  });

  it('stays silent on the normal plate-matched path', () => {
    expect(matchedByUnitLabel(false, '5424940')).toBe('');
  });
});

// ── The re-plate case, 2026-08-25 ─────────────────────────────────────────────
// The label used to hardcode "the plate wasn't readable on the tag". That's ONE of two causes,
// and the other is the interesting one: an out-of-province car converted to MB plates keeps its
// unit number and owning area but changes the only key FG searches by. The unit fallback resolves
// it correctly — and then the line explained itself with a confident lie.
describe('matchedByUnitLabel — deriving WHY the unit did the work', () => {
  it('still blames the tag when the plate genuinely was not read', () => {
    expect(matchedByUnitLabel(true, '5769880', null, '0GK641')).toMatch(/wasn't readable/);
    expect(matchedByUnitLabel(true, '5769880', '', '0GK641')).toMatch(/wasn't readable/);
  });

  it('names BOTH plates when the tag was perfectly legible and simply disagrees', () => {
    const label = matchedByUnitLabel(true, '576 9880', 'LZM123', '0GK641');
    expect(label).toContain('5769880');
    expect(label).toContain('LZM123');    // what the tag says now
    expect(label).toContain('0GK641');    // what FG still believes
    expect(label).toMatch(/Re-plated/);
    expect(label).not.toMatch(/wasn't readable/);   // the lie must be gone
  });

  it('does not cry re-plate over spacing or case', () => {
    expect(matchedByUnitLabel(true, '5769880', 'lzm 123', 'LZM123')).toMatch(/wasn't readable/);
  });

  it('says nothing at all when the plate did the work', () => {
    expect(matchedByUnitLabel(false, '5769880', 'LZM123', 'LZM123')).toBe('');
  });
});

describe('isPlateMismatch', () => {
  it('is true only when both plates exist and differ', () => {
    expect(isPlateMismatch('LZM123', '0GK641')).toBe(true);
    expect(isPlateMismatch('LZM123', 'LZM123')).toBe(false);
    expect(isPlateMismatch('  lzm123 ', 'LZM123')).toBe(false);   // normalised, not a mismatch
    expect(isPlateMismatch(null, '0GK641')).toBe(false);          // unreadable tag is not a mismatch
    expect(isPlateMismatch('LZM123', null)).toBe(false);
  });
});

// The orange line on Aaron's own screenshot, 2026-09-13:
//   "Matched by unit #5627245 — the tag reads TR2260, but this car is on file as FTR2260.
//    Re-plated? Open the record to update the plate."
// Nothing was re-plated. The tag's perforation ate the first character of every line — and that
// sentence points him at the one action that would destroy a plate he verified by hand.
describe('matchedByUnitLabel — the clipped tag', () => {
  it('⭐⭐ names the clip instead of inventing a re-plate', () => {
    const s = matchedByUnitLabel(true, '5627245', 'TR2260', 'FTR2260');
    expect(s).toMatch(/left edge is cut off/i);
    expect(s).toMatch(/The record is right/i);
  });

  it('⚠️⚠️ never sends him to update the plate on a clipped tag', () => {
    expect(matchedByUnitLabel(true, '5627245', 'TR2260', 'FTR2260')).not.toMatch(/re-?plated|update the plate/i);
  });

  it('⚠️ a genuine re-plate still says so — the third cause did not eat the second', () => {
    expect(matchedByUnitLabel(true, '5627245', 'LZM500', '0GK641')).toMatch(/Re-plated\?/);
  });

  it('an unreadable plate still reads as the FYI it is', () => {
    expect(matchedByUnitLabel(true, '5627245', '', 'FTR2260')).toMatch(/wasn't readable/);
  });
});

describe('isPlateMismatch — tone', () => {
  // ⚠️ Amber means "this needs a decision". A clipped tag needs none, and amber he learns to
  // ignore is worse than no amber at all.
  it('⚠️⚠️ a clipped tag is NOT a plate change', () => {
    expect(isPlateMismatch('TR2260', 'FTR2260')).toBe(false);
  });

  it('a real plate change still is', () => {
    expect(isPlateMismatch('LZM500', '0GK641')).toBe(true);
  });
});

describe('matchedByClippedTagLabel', () => {
  it('⭐ names the car AND tells him not to trust the rest of that tag', () => {
    const s = matchedByClippedTagLabel(true, { licensePlate: 'FTR2260', unitNumber: '5627245' });
    expect(s).toMatch(/FTR2260/);
    expect(s).toMatch(/missing the first character of every line/i);
    expect(s).toMatch(/Don't trust the rest of the tag|Don’t trust the rest of the tag/i);
  });

  it('is silent when the clip did not do the matching', () => {
    expect(matchedByClippedTagLabel(false, { licensePlate: 'FTR2260', unitNumber: '5627245' })).toBe('');
    expect(matchedByClippedTagLabel(true, null)).toBe('');
  });
});
