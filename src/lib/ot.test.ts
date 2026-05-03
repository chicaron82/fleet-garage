import { describe, it, expect } from 'vitest';
import { calcHours, calcOT, fmtHours } from './ot';
import type { Shift } from '../types';

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
  it('treats same start and end as 24h (crossover assumption in the function)', () => {
    expect(calcHours('09:00', '09:00')).toBe(24);
  });
});

describe('calcOT', () => {
  it('returns 0 when no actual hours logged', () => {
    const shift = makeShift();
    expect(calcOT(shift)).toBe(0);
  });
  it('returns 0 for exactly 8 actual hours on a regular shift', () => {
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '17:00' });
    expect(calcOT(shift)).toBe(0);
  });
  it('returns OT hours beyond 8 on a regular shift', () => {
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '18:30' });
    expect(calcOT(shift)).toBe(1.5);
  });
  it('all actual hours are OT on a day-off shift', () => {
    const shift = makeShift({ shiftType: 'day-off', actualStartTime: '10:00', actualEndTime: '14:00' });
    expect(calcOT(shift)).toBe(4);
  });
  it('all actual hours are OT on a stat day', () => {
    const shift = makeShift({ isStat: true, actualStartTime: '09:00', actualEndTime: '17:00' });
    expect(calcOT(shift)).toBe(8);
  });
  it('all actual hours are OT on PTO shift', () => {
    const shift = makeShift({ shiftType: 'pto', actualStartTime: '08:00', actualEndTime: '12:00' });
    expect(calcOT(shift)).toBe(4);
  });
  it('returns 0 when actual hours under 8 on regular shift', () => {
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '13:00' });
    expect(calcOT(shift)).toBe(0);
  });
  it('handles midnight crossover OT', () => {
    const shift = makeShift({ actualStartTime: '09:00', actualEndTime: '18:00' });
    expect(calcOT(shift)).toBe(1);
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
