import { describe, it, expect } from 'vitest';
import { parseAllowlist, isAllowed } from '../../../api/_lib/assistantAccess';

describe('parseAllowlist', () => {
  it('splits, trims, lower-cases, and drops blanks', () => {
    expect(parseAllowlist(' A1B2 , c3d4 ,, ')).toEqual(['a1b2', 'c3d4']);
  });

  it('returns [] for undefined or empty', () => {
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist('')).toEqual([]);
    expect(parseAllowlist('  ,  ')).toEqual([]);
  });
});

describe('isAllowed', () => {
  it('open to all when the allowlist is unset/empty', () => {
    expect(isAllowed('anyone', undefined)).toBe(true);
    expect(isAllowed('anyone', '')).toBe(true);
    expect(isAllowed(null, '')).toBe(true);
  });

  it('allows an exact (case-insensitive) match', () => {
    expect(isAllowed('A1B2', 'a1b2')).toBe(true);
    expect(isAllowed('a1b2', 'A1B2,C3D4')).toBe(true);
  });

  it('denies an account not on the list', () => {
    expect(isAllowed('x9y9', 'a1b2,c3d4')).toBe(false);
    expect(isAllowed(null, 'a1b2')).toBe(false);
    expect(isAllowed(undefined, 'a1b2')).toBe(false);
  });
});
