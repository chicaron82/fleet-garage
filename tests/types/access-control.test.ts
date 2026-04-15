import { describe, it, expect } from 'vitest';
import { canRelease, CAN_RELEASE } from '../../src/types';
import type { UserRole } from '../../src/types';

// Every role in the system
const ALL_ROLES: UserRole[] = [
  'VSA',
  'Lead VSA',
  'CSR',
  'HIR',
  'Branch Manager',
  'Operations Manager',
  'Driver',
];

describe('canRelease', () => {
  it('returns true for Branch Manager', () => {
    expect(canRelease('Branch Manager')).toBe(true);
  });

  it('returns true for Operations Manager', () => {
    expect(canRelease('Operations Manager')).toBe(true);
  });

  it('returns false for VSA', () => {
    expect(canRelease('VSA')).toBe(false);
  });

  it('returns false for Lead VSA', () => {
    expect(canRelease('Lead VSA')).toBe(false);
  });

  it('returns false for CSR', () => {
    expect(canRelease('CSR')).toBe(false);
  });

  it('returns false for HIR', () => {
    expect(canRelease('HIR')).toBe(false);
  });

  it('returns false for Driver', () => {
    expect(canRelease('Driver')).toBe(false);
  });

  it('only management roles are in CAN_RELEASE', () => {
    expect(CAN_RELEASE).toEqual(['Branch Manager', 'Operations Manager']);
  });

  it('all roles are accounted for — no role silently missing', () => {
    // Every role must return a defined boolean, not undefined or throw
    for (const role of ALL_ROLES) {
      expect(typeof canRelease(role)).toBe('boolean');
    }
  });
});
