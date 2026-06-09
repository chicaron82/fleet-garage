import { describe, it, expect } from 'vitest';
import { findPriorShiftLog, isCarryOverOnly } from '../../src/lib/washbayLineage';

// Local-time constructor — keeps assertions timezone-independent (shiftDateStr
// reads local components).
const at = (y: number, mo: number, d: number, h: number, mi = 0) =>
  new Date(y, mo - 1, d, h, mi);

// A morning handoff on June 2 → the prior shift-day is 2026-06-01.
const morning = at(2026, 6, 2, 9, 0);

describe('findPriorShiftLog', () => {
  it('finds the prior shift-day close and its carry-over (backfill → inherited)', () => {
    const logs = [
      { date: '2026-06-02', carsRemaining: 9 }, // today's own close — not the prior
      { date: '2026-06-01', carsRemaining: 2 }, // last night's close (or the backfill)
    ];
    expect(findPriorShiftLog(logs, morning)?.carsRemaining).toBe(2);
  });

  it("does not treat today's log as the prior shift-day", () => {
    const logs = [{ date: '2026-06-02', carsRemaining: 5 }];
    expect(findPriorShiftLog(logs, morning)).toBeUndefined();
  });

  it('returns undefined when last night was never logged', () => {
    const logs = [{ date: '2026-05-30', carsRemaining: 3 }];
    expect(findPriorShiftLog(logs, morning)).toBeUndefined();
  });

  it('reckons the prior day by shift-day, not calendar (post-midnight)', () => {
    // 02:00 on June 2 is still the June 1 shift; the prior shift-day is May 31.
    const logs = [
      { date: '2026-06-01', carsRemaining: 4 },
      { date: '2026-05-31', carsRemaining: 7 },
    ];
    expect(findPriorShiftLog(logs, at(2026, 6, 2, 2, 0))?.carsRemaining).toBe(7);
  });
});

describe('isCarryOverOnly', () => {
  it('flags a zero-counter row (a lightweight opener backfill)', () => {
    expect(isCarryOverOnly({ fullPages: 0, lastPageEntries: 0 })).toBe(true);
  });

  it('does not flag a real close (the form requires cars on the sheet)', () => {
    expect(isCarryOverOnly({ fullPages: 3, lastPageEntries: 5 })).toBe(false);
    expect(isCarryOverOnly({ fullPages: 0, lastPageEntries: 4 })).toBe(false);
  });
});
