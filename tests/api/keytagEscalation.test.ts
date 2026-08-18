import { describe, it, expect } from 'vitest';
import { shouldEscalate, hasIdentityKey, unitDigits, plateKey } from '../../api/_lib/keytagEscalation';
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
