import { describe, it, expect } from 'vitest';
import { rosteredVsaCount, presentVsaCount } from '../../src/lib/rosterCount';
import type { ShiftType, UserRole, Attendance } from '../../src/types';

const row = (userId: string, date: string, shiftType: ShiftType, role: UserRole, attendance?: Attendance) =>
  ({ userId, date, shiftType, user: { role }, attendance });

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

  it('dedupes a user who appears in duplicate rows for the same window', () => {
    const shifts = [row('a', DAY, 'opening', 'VSA'), row('a', DAY, 'opening', 'VSA')];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('is zero when nobody matches', () => {
    expect(rosteredVsaCount([], DAY, ['opening'])).toBe(0);
  });
});

describe('presentVsaCount', () => {
  it('equals the roster when nobody is absent (unmarked + present both count)', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),               // unmarked → counts
      row('b', DAY, 'opening', 'VSA', 'present'),     // present  → counts
    ];
    expect(presentVsaCount(shifts, DAY, ['opening'])).toBe(2);
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(2); // roster unchanged
  });

  it('drops anyone marked absent (no-show/sick), so the rate divides by who showed', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA', 'present'),
      row('b', DAY, 'opening', 'VSA', 'absent'),      // no-show → excluded
      row('c', DAY, 'opening', 'VSA'),                // unmarked → still counts
    ];
    expect(presentVsaCount(shifts, DAY, ['opening'])).toBe(2);
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(3); // roster still 3 — the delta is the signal
  });
});
