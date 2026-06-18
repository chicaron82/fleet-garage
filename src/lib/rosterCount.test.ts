import { describe, it, expect } from 'vitest';
import { rosteredVsaCount } from './rosterCount';
import type { ShiftType, UserRole } from '../types';

const s = (userId: string, date: string, shiftType: ShiftType, role: UserRole) =>
  ({ userId, date, shiftType, user: { role } });

const TODAY = '2026-06-17';

describe('rosteredVsaCount', () => {
  const roster = [
    s('u1', TODAY, 'closing', 'VSA'),
    s('u2', TODAY, 'closing', 'Lead VSA'),
    s('u3', TODAY, 'opening', 'VSA'),          // wrong window
    s('u4', TODAY, 'closing', 'CSR'),          // non-VSA role
    s('u5', '2026-06-16', 'closing', 'VSA'),   // wrong date
  ];

  it('counts VSA + Lead VSA in the requested window on that date', () => {
    expect(rosteredVsaCount(roster, TODAY, ['closing'])).toBe(2);
  });

  it('pulls the opening crew for the morning window', () => {
    expect(rosteredVsaCount(roster, TODAY, ['opening'])).toBe(1);
  });

  it('excludes non-VSA roles, other windows, and other dates', () => {
    // u4 (CSR), u3 (opening), u5 (wrong date) all excluded from the closing count.
    expect(rosteredVsaCount(roster, TODAY, ['closing'])).not.toBe(3);
  });

  it('dedupes a user with duplicate rows', () => {
    const dup = [s('u1', TODAY, 'closing', 'VSA'), s('u1', TODAY, 'closing', 'VSA')];
    expect(rosteredVsaCount(dup, TODAY, ['closing'])).toBe(1);
  });

  it('returns 0 when nobody is rostered (caller falls back to the manual default)', () => {
    expect(rosteredVsaCount([], TODAY, ['closing'])).toBe(0);
  });
});
