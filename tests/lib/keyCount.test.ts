// The comparison is the whole feature — a stored number alone still leaves Aaron remembering
// the Carnival went out with 4. These pin the diff, the first-count seeding, and the counter note.
import { describe, it, expect } from 'vitest';
import { checkKeys, keyShortNote } from '../../src/lib/keyCount';

describe('checkKeys', () => {
  it('a whole return is not short', () => {
    const c = checkKeys(4, 4);
    expect(c.short).toBe(0);
    expect(c.seedsBaseline).toBe(false);
  });

  it('catches the Carnival coming back a key down', () => {
    const c = checkKeys(4, 3);
    expect(c.short).toBe(1);
    expect(c.expected).toBe(4);
    expect(c.observed).toBe(3);
  });

  it('counts multiple missing keys', () => {
    expect(checkKeys(4, 2).short).toBe(2);
  });

  it('first count on an unknown car SEEDS the baseline instead of crying short', () => {
    const c = checkKeys(null, 2);
    expect(c.seedsBaseline).toBe(true);
    expect(c.short).toBe(0);
    expect(c.expected).toBeNull();
  });

  it('treats a zero/absent baseline as no baseline — never a false shortfall', () => {
    expect(checkKeys(0, 2).seedsBaseline).toBe(true);
    expect(checkKeys(0, 2).short).toBe(0);
  });

  it('MORE keys than expected is not a shortfall (never a negative)', () => {
    expect(checkKeys(2, 4).short).toBe(0);
  });
});

describe('keyShortNote', () => {
  it('is empty when nothing is missing — safe to append unconditionally', () => {
    expect(keyShortNote(checkKeys(4, 4))).toBe('');
    expect(keyShortNote(checkKeys(null, 3))).toBe('');
  });

  it('names the shortfall for the counter while the contract is open', () => {
    expect(keyShortNote(checkKeys(4, 3))).toBe('⚠️ 1 key short (3/4)');
  });

  it('pluralizes', () => {
    expect(keyShortNote(checkKeys(4, 2))).toBe('⚠️ 2 keys short (2/4)');
  });
});
