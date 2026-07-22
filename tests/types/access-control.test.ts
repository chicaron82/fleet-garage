import { describe, it, expect } from 'vitest';
import { canRelease, CAN_RELEASE, canMarkRepaired, CAN_MARK_REPAIRED, canManageVehicles } from '../../src/types';
import type { UserRole } from '../../src/types';

// Every role in the system
const ALL_ROLES: UserRole[] = [
  'VSA',
  'Lead VSA',
  'CSR',
  'HIR',
  'Branch Manager',
  'Operations Manager',
  'City Manager',
  'AGM',
  'GM',
  'Driver',
];

describe('canRelease', () => {
  it('returns true for Branch Manager', () => {
    expect(canRelease('Branch Manager')).toBe(true);
  });

  it('returns true for Operations Manager', () => {
    expect(canRelease('Operations Manager')).toBe(true);
  });

  it('returns true for City Manager', () => {
    expect(canRelease('City Manager')).toBe(true);
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
    expect(CAN_RELEASE).toEqual(['Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM']);
  });

  it('returns true for AGM', () => {
    expect(canRelease('AGM')).toBe(true);
  });

  it('returns true for GM', () => {
    expect(canRelease('GM')).toBe(true);
  });

  it('all roles are accounted for — no role silently missing', () => {
    // Every role must return a defined boolean, not undefined or throw
    for (const role of ALL_ROLES) {
      expect(typeof canRelease(role)).toBe('boolean');
    }
  });
});

describe('canMarkRepaired', () => {
  it('returns true for VSA and Lead VSA — they confirm a repair they can see', () => {
    expect(canMarkRepaired('VSA')).toBe(true);
    expect(canMarkRepaired('Lead VSA')).toBe(true);
  });

  it('returns true for every management role (a superset of canRelease)', () => {
    for (const role of CAN_RELEASE) {
      expect(canMarkRepaired(role)).toBe(true);
    }
  });

  it('returns false for CSR, HIR, and Driver — not at the washbay, do not flag', () => {
    expect(canMarkRepaired('CSR')).toBe(false);
    expect(canMarkRepaired('HIR')).toBe(false);
    expect(canMarkRepaired('Driver')).toBe(false);
  });

  it('is exactly VSA + Lead VSA on top of CAN_RELEASE', () => {
    expect(CAN_MARK_REPAIRED).toEqual([
      'VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM',
    ]);
  });

  it('anyone who can release can also mark repaired (release ⊂ mark-repaired)', () => {
    for (const role of ALL_ROLES) {
      if (canRelease(role)) expect(canMarkRepaired(role)).toBe(true);
    }
  });

  it('all roles return a defined boolean — no role silently missing', () => {
    for (const role of ALL_ROLES) {
      expect(typeof canMarkRepaired(role)).toBe('boolean');
    }
  });
});

describe('canManageVehicles', () => {
  it('returns true for VSA and Lead VSA — the floor role gets direct identity edits', () => {
    // The bug this pins (found live 2026-07-22): Lead VSA was missing while every OTHER
    // role-gate in this file pairs VSA with Lead VSA — it silently routed a Lead VSA to
    // the suggest-and-wait-for-approval sheet instead of the direct edit modal.
    expect(canManageVehicles('VSA')).toBe(true);
    expect(canManageVehicles('Lead VSA')).toBe(true);
  });

  it('returns true for every management role', () => {
    expect(canManageVehicles('Branch Manager')).toBe(true);
    expect(canManageVehicles('Operations Manager')).toBe(true);
    expect(canManageVehicles('City Manager')).toBe(true);
  });

  it('returns false for CSR, HIR, and Driver — they suggest, they do not directly edit', () => {
    expect(canManageVehicles('CSR')).toBe(false);
    expect(canManageVehicles('HIR')).toBe(false);
    expect(canManageVehicles('Driver')).toBe(false);
  });

  it('all roles return a defined boolean — no role silently missing', () => {
    for (const role of ALL_ROLES) {
      expect(typeof canManageVehicles(role)).toBe('boolean');
    }
  });
});
