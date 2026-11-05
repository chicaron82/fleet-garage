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

// Aaron, 2026-11-04: *"Overtime hours for me were added today, so why still roster of 1?"* He opened, went home, and
// came back 18:00–21:00 to close with Khaiat (docs/ticket-roster-counts-plus-block-at-close.md).
describe('⭐ a [+] block after the shift puts them on the close', () => {
  const opener = (userId: string, more: { start: string; end: string }[], attendance?: Attendance) =>
    ({ ...row(userId, DAY, 'opening', 'VSA', attendance), startTime: '06:45', endTime: '15:15', extraBlocks: more });
  const tonight = [opener('aaron', [{ start: '18:00', end: '21:00' }]), row('khaiat', DAY, 'closing', 'VSA', 'present')];

  it('⭐ tonight: the opener who came back counts, so the roster shows 2', () => {
    expect(rosteredVsaCount(tonight, DAY, ['closing'])).toBe(2);
    expect(presentVsaCount(tonight, DAY, ['closing'])).toBe(2);
  });

  it('the opening handoff ignores the block: he is still one opener', () => {
    expect(rosteredVsaCount(tonight, DAY, ['opening'])).toBe(1);
  });

  it('a block before the shift is not a return trip', () => {
    expect(rosteredVsaCount([opener('a', [{ start: '05:00', end: '06:45' }])], DAY, ['closing'])).toBe(0);
  });

  it('the logged end wins: a block that starts after it counts', () => {
    const s = { ...opener('a', [{ start: '16:00', end: '21:00' }]), endTime: '17:00', actualEndTime: '15:00' };
    expect(rosteredVsaCount([s], DAY, ['closing'])).toBe(1);
  });

  it('marked absent: on the roster, off the present count', () => {
    const shifts = [opener('a', [{ start: '18:00', end: '21:00' }], 'absent')];
    expect(rosteredVsaCount(shifts, DAY, ['closing'])).toBe(1);
    expect(presentVsaCount(shifts, DAY, ['closing'])).toBe(0);
  });

  it('a closer with a block of their own is still one person', () => {
    const s = { ...row('k', DAY, 'closing', 'VSA'), endTime: '22:00', extraBlocks: [{ start: '23:00', end: '23:30' }] };
    expect(rosteredVsaCount([s], DAY, ['closing'])).toBe(1);
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
