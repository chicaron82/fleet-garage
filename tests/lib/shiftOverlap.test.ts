import { describe, it, expect } from 'vitest';
import { overlapMinutes, fmtOverlap } from '../../src/lib/shiftOverlap';

describe('overlapMinutes', () => {
  it('computes the shared window of two overlapping shifts', () => {
    // Aaron 14:30–23:00 vs Vladimir 16:30–23:00 → 6h30m
    expect(overlapMinutes(
      { startTime: '14:30:00', endTime: '23:00:00' },
      { startTime: '16:30:00', endTime: '23:00:00' },
    )).toBe(390);
  });

  it('computes a partial overlap where one clocks out mid-shift', () => {
    // Aaron 14:30–23:00 vs Larry 08:00–16:30 → 2h (14:30–16:30)
    expect(overlapMinutes(
      { startTime: '14:30:00', endTime: '23:00:00' },
      { startTime: '08:00:00', endTime: '16:30:00' },
    )).toBe(120);
  });

  it('returns 0 when the windows do not touch', () => {
    expect(overlapMinutes(
      { startTime: '06:45:00', endTime: '13:00:00' },
      { startTime: '16:30:00', endTime: '23:00:00' },
    )).toBe(0);
  });

  it('returns 0 when they merely abut (end === start)', () => {
    expect(overlapMinutes(
      { startTime: '08:00:00', endTime: '16:30:00' },
      { startTime: '16:30:00', endTime: '23:00:00' },
    )).toBe(0);
  });

  it('returns 0 when either side has no window (day-off / PTO / sick)', () => {
    expect(overlapMinutes({ startTime: null, endTime: null }, { startTime: '08:00:00', endTime: '16:30:00' })).toBe(0);
    expect(overlapMinutes({ startTime: '08:00:00', endTime: '16:30:00' }, {})).toBe(0);
  });

  it('handles full containment (returns the inner window)', () => {
    expect(overlapMinutes(
      { startTime: '06:00:00', endTime: '23:00:00' },
      { startTime: '10:00:00', endTime: '18:30:00' },
    )).toBe(510); // 8h30m
  });
});

describe('fmtOverlap', () => {
  it('formats hours and minutes compactly', () => {
    expect(fmtOverlap(390)).toBe('6h30m');
    expect(fmtOverlap(120)).toBe('2h');
    expect(fmtOverlap(45)).toBe('45m');
    expect(fmtOverlap(0)).toBe('0m');
  });
});
