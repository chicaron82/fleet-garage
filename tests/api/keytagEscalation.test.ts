import { describe, it, expect } from 'vitest';
import { shouldEscalate, corroborates, hasIdentityKey, unitDigits, plateKey } from '../../api/_lib/keytagEscalation';
import type { FleetHit } from '../../api/_lib/keytagEscalation';
import type { KeytagRead } from '../../api/_lib/keytagRead';

const read = (o: Partial<KeytagRead> = {}): KeytagRead => ({ ...o } as KeytagRead);

describe('unitDigits / plateKey', () => {
  it('joins the digit groups the tag prints', () => {
    expect(unitDigits('542 4882')).toBe('5424882');
  });
  it('normalizes a plate the way a match compares it', () => {
    expect(plateKey(' lur 243 ')).toBe('LUR243');
  });
  it('survives nulls', () => {
    expect(unitDigits(null)).toBe('');
    expect(plateKey(undefined)).toBe('');
  });
});

describe('shouldEscalate', () => {
  it('⭐ leaves a MATCHED read alone — the fleet already confirmed it', () => {
    // The whole saving. A read that lands on a known car is self-verified by an independent
    // record, which beats a second opinion from a bigger model.
    expect(shouldEscalate(read({ plate: 'LUR243', unitNumber: '5424882' }), true)).toBe(false);
  });

  it('⭐ escalates an UNMATCHED read — no record exists to correct it against', () => {
    // Either a new car (the read BECOMES the record) or a misread. Both want the strong model,
    // and here they are indistinguishable.
    expect(shouldEscalate(read({ plate: 'ASR862', unitNumber: '8619' }), false)).toBe(true);
  });

  it('escalates when the tag gave no identity key at all', () => {
    expect(shouldEscalate(read({ color: 'Blue', year: 2025 }), false)).toBe(true);
    expect(shouldEscalate(read({}), false)).toBe(true);
    expect(shouldEscalate(null, false)).toBe(true);
  });

  it('⭐ one key is enough — a torn tag with only a unit number still resolves', () => {
    // The crumpled-tag case: plate torn away, "Veh #" legible. Matching on the unit alone is a
    // confirmed identification, so it must NOT pay for a second read.
    expect(shouldEscalate(read({ unitNumber: '542 4940' }), true)).toBe(false);
    expect(shouldEscalate(read({ plate: 'LUR249' }), true)).toBe(false);
  });

  it('a key that matches nothing still escalates, even though a key was present', () => {
    expect(hasIdentityKey(read({ plate: 'ZZZZZZ' }))).toBe(true);
    expect(shouldEscalate(read({ plate: 'ZZZZZZ' }), false)).toBe(true);
  });

  it('whitespace-only fields do not count as identity keys', () => {
    expect(hasIdentityKey(read({ plate: '   ', unitNumber: ' ' }))).toBe(false);
    expect(shouldEscalate(read({ plate: '   ' }), false)).toBe(true);
  });
});

const hit = (plate: string, unit: string, id = plate): FleetHit =>
  ({ id, license_plate: plate, unit_number: unit });

describe('corroborates — the fleet has to confirm the read, not just brush it', () => {
  it('⭐ REJECTS a misread plate that landed on a DIFFERENT REAL CAR', () => {
    // The hole /reflect 58 found. Haiku reads LUR489 as LUR480 — both live. The old "did anything
    // match" test said yes, escalation was skipped, and FG resolved to the wrong car confidently.
    // The unit is the tiebreak: LUR480's record does not carry 5424882.
    const read = { plate: 'LUR480', unitNumber: '5424882' } as KeytagRead;
    expect(corroborates(read, [hit('LUR480', '5421111'), hit('LUR489', '5424882')])).toBe(false);
  });

  it('accepts a read whose plate and unit land on the SAME car', () => {
    const read = { plate: 'LUR489', unitNumber: '542 4882' } as KeytagRead;
    expect(corroborates(read, [hit('LUR489', '5424882')])).toBe(true);
  });

  it('rejects a plate that matched while the unit matched nothing at all', () => {
    // One of the two fields was misread. Which one is unknowable here — so pay for the good model.
    const read = { plate: 'LUR489', unitNumber: '9999999' } as KeytagRead;
    expect(corroborates(read, [hit('LUR489', '5424882')])).toBe(false);
  });

  it('⭐ one key only (the crumpled tag) still corroborates on a single hit', () => {
    expect(corroborates({ unitNumber: '542 4940' } as KeytagRead, [hit('LUR243', '5424940')])).toBe(true);
    expect(corroborates({ plate: 'LUR243' } as KeytagRead, [hit('LUR243', '5424940')])).toBe(true);
  });

  it('a shared unit number still corroborates when the plate agrees with one of them', () => {
    // Three unit numbers are carried by two live cars each. The plate picks which.
    const read = { plate: 'LUR512', unitNumber: '5427497' } as KeytagRead;
    expect(corroborates(read, [hit('LUR512', '5427497'), hit('LZM330', '5427497')])).toBe(true);
  });

  it('no hits, no keys, no corroboration', () => {
    expect(corroborates({ plate: 'ZZZZZZ' } as KeytagRead, [])).toBe(false);
    expect(corroborates({} as KeytagRead, [hit('LUR489', '5424882')])).toBe(false);
    expect(corroborates(null, [hit('LUR489', '5424882')])).toBe(false);
  });
});
