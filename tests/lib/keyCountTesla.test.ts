import { describe, it, expect } from 'vitest';
import {
  checkKeys, keyOptionsFor, keyNoun, keyShortSeverity, keyShortNoteFor, keyShortNote,
  TESLA_KEYCARD_COUNT,
} from '../../src/lib/keyCount';

describe('a Tesla carries exactly one keycard', () => {
  it('⭐ the picker offers only the answer that can be true', () => {
    // 2/3/4 on a Tesla are questions with no true answer — on a row tapped with nitrile gloves on.
    expect(keyOptionsFor(true)).toEqual([1]);
    expect(keyOptionsFor(false)).toEqual([1, 2, 3, 4]);
    expect(TESLA_KEYCARD_COUNT).toBe(1);
  });

  it('calls the thing what it is', () => {
    expect(keyNoun(true, 1)).toBe('keycard');
    expect(keyNoun(false, 1)).toBe('key on the ring');
    expect(keyNoun(false, 3)).toBe('keys on the ring');
  });
});

describe('a missing card is an immobilisation, not a shortfall', () => {
  const shortByOne = checkKeys(1, 0);

  it('⭐ severity belongs to the CAR, not to the number', () => {
    // Identical arithmetic — one short — and two completely different consequences. On a Corolla the
    // car still drives and the loss is chargeable at the counter. On a Tesla it cannot be moved.
    expect(keyShortSeverity(shortByOne, false)).toBe('short');
    expect(keyShortSeverity(shortByOne, true)).toBe('grounded');
  });

  it('⭐ the wording refuses to read like paperwork', () => {
    expect(keyShortNoteFor(shortByOne, true)).toMatch(/GROUNDED/);
    expect(keyShortNoteFor(shortByOne, true)).toMatch(/cannot be driven/);
    expect(keyShortNoteFor(shortByOne, false)).toBe(keyShortNote(shortByOne));
  });

  it('a whole car says nothing at all, either way', () => {
    const whole = checkKeys(1, 1);
    expect(keyShortSeverity(whole, true)).toBe('none');
    expect(keyShortNoteFor(whole, true)).toBe('');
  });

  it('a first count seeds the baseline rather than reporting a loss', () => {
    // Nothing to compare against yet — a Tesla FG has never counted is not a grounded Tesla.
    const first = checkKeys(null, 1);
    expect(first.seedsBaseline).toBe(true);
    expect(keyShortSeverity(first, true)).toBe('none');
  });
});
