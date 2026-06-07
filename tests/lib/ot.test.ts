import { describe, it, expect } from 'vitest';
import { calcHours, netActualHours, calcOT, fmtHours, BREAK_THRESHOLD_HRS, UNPAID_BREAK_HRS } from '../../src/lib/ot';
import type { Shift } from '../../src/types';

function makeShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 's1', userId: 'u1', date: '2026-04-14',
    shiftType: 'opening', startTime: '09:00', endTime: '17:00',
    createdAt: '2026-04-14T00:00:00', updatedAt: '2026-04-14T00:00:00',
    branchId: 'YWG',
    ...overrides,
  };
}

describe('calcHours', () => {
  it('returns 0 when both undefined', () => {
    expect(calcHours(undefined, undefined)).toBe(0);
  });
  it('returns 0 when only start defined', () => {
    expect(calcHours('09:00', undefined)).toBe(0);
  });
  it('calculates standard 8-hour shift', () => {
    expect(calcHours('09:00', '17:00')).toBe(8);
  });
  it('calculates partial shift', () => {
    expect(calcHours('09:00', '13:30')).toBe(4.5);
  });
  it('handles midnight crossover (22:00–00:30)', () => {
    expect(calcHours('22:00', '00:30')).toBe(2.5);
  });
  it('handles exact midnight end', () => {
    expect(calcHours('20:00', '00:00')).toBe(4);
  });
  it('treats same start and end as 0 — data-entry slip, not a 24h crossover', () => {
    expect(calcHours('09:00', '09:00')).toBe(0);
  });
});

describe('netActualHours', () => {
  it('does not deduct below the threshold', () => {
    expect(netActualHours(4)).toBe(4);
    expect(netActualHours(4.9)).toBe(4.9);
  });
  it('deducts the break at the threshold', () => {
    expect(netActualHours(BREAK_THRESHOLD_HRS)).toBe(BREAK_THRESHOLD_HRS - UNPAID_BREAK_HRS);
  });
  it('deducts the break above the threshold', () => {
    // 5.5h driver shift: 5.5 − 0.5 = 5h net
    expect(netActualHours(5.5)).toBe(5);
    // 9.5h actual: 9.5 − 0.5 = 9h net
    expect(netActualHours(9.5)).toBe(9);
  });
});

describe('calcOT', () => {
  it('returns 0 when no actual hours logged', () => {
    const shift = makeShift();
    expect(calcOT(shift)).toBe(0);
  });

  it('returns 0 for exactly 8 actual hours on a regular shift (break already in)', () => {
    // 8h gross < break threshold? No — 8 ≥ 5, so net = 7.5h → 0 OT
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '17:00' });
    expect(calcOT(shift)).toBe(0);
  });

  it('returns OT hours beyond 8 net on a regular shift', () => {
    // 9.5h gross − 0.5h break = 9h net → 1h OT
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '18:30' });
    expect(calcOT(shift)).toBe(1);
  });

  it('returns 0 when actual hours under threshold on regular shift (no break deducted)', () => {
    // 4h gross, < 5h → 4h net → 4 − 8 < 0 → 0 OT
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '13:00' });
    expect(calcOT(shift)).toBe(0);
  });

  it('all net hours are OT on a day-off shift (short call-in, no break)', () => {
    // 4h gross, < 5h → 4h net → 4h OT
    const shift = makeShift({ shiftType: 'day-off', actualStartTime: '10:00', actualEndTime: '14:00' });
    expect(calcOT(shift)).toBe(4);
  });

  it('deducts break for day-off shifts ≥ 5h', () => {
    // 8h gross − 0.5h break = 7.5h net → 7.5h OT
    const shift = makeShift({ shiftType: 'day-off', actualStartTime: '09:00', actualEndTime: '17:00' });
    expect(calcOT(shift)).toBe(7.5);
  });

  it('all net hours are OT on a stat day', () => {
    // 8h gross − 0.5h break = 7.5h net → 7.5h OT
    const shift = makeShift({ isStat: true, actualStartTime: '09:00', actualEndTime: '17:00' });
    expect(calcOT(shift)).toBe(7.5);
  });

  it('all net hours are OT on PTO shift', () => {
    // 4h gross, < 5h → 4h net → 4h OT
    const shift = makeShift({ shiftType: 'pto', actualStartTime: '08:00', actualEndTime: '12:00' });
    expect(calcOT(shift)).toBe(4);
  });

  it('handles 9h actual: 9 − 0.5 break = 8.5h net → 0.5h OT', () => {
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '18:00' });
    expect(calcOT(shift)).toBe(0.5);
  });
});

describe('fmtHours', () => {
  it('formats zero hours', () => {
    expect(fmtHours(0)).toBe('0h');
  });
  it('formats whole hours', () => {
    expect(fmtHours(8)).toBe('8h');
  });
  it('formats hours with minutes', () => {
    expect(fmtHours(8.5)).toBe('8h 30m');
  });
  it('formats minutes only (under 1 hour)', () => {
    expect(fmtHours(0.5)).toBe('0h 30m');
  });
  it('rounds minutes correctly', () => {
    expect(fmtHours(1.25)).toBe('1h 15m');
  });
  it('formats large OT value', () => {
    expect(fmtHours(12.75)).toBe('12h 45m');
  });
});
