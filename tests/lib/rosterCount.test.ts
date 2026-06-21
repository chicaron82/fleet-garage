import { describe, it, expect } from 'vitest';
import { rosteredVsaCount } from '../../src/lib/rosterCount';
import type { ShiftType, UserRole } from '../../src/types';

const row = (userId: string, date: string, shiftType: ShiftType, role: UserRole) =>
  ({ userId, date, shiftType, user: { role } });

const DAY = '2026-06-15';

describe('rosteredVsaCount', () => {
  it('counts distinct VSAs in the requested window(s) on the date', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('b', DAY, 'opening', 'Lead VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(2);
  });

  it('ignores non-VSA roles', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('mgr', DAY, 'opening', 'Branch Manager'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('ignores other shift types and other dates', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('b', DAY, 'closing', 'VSA'),
      row('c', '2026-06-16', 'opening', 'VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('counts a person once even across multiple window types', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('a', DAY, 'closing', 'VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening', 'closing'])).toBe(1);
  });

  it('is zero when nobody matches', () => {
    expect(rosteredVsaCount([], DAY, ['opening'])).toBe(0);
  });
});
