import { describe, it, expect } from 'vitest';
import { calcHours, netActualHours, calcOT, fmtHours, invalidTimeSpan, BREAK_THRESHOLD_HRS } from '../../src/lib/ot';
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
  it('does not deduct at exactly the threshold (break owed after 5h, not at 5h)', () => {
    expect(netActualHours(BREAK_THRESHOLD_HRS)).toBe(BREAK_THRESHOLD_HRS);
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
    // 8h gross < break threshold? No — 8 > 5, so net = 7.5h → 0 OT
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

// Aaron, 2026-09-14 00:31, logging the night he came in to lock up and stayed to clear the path:
// clocked 23:08 → 00:11, and the sheet refused him — "Actual end time must be after start time" —
// while the summary right beneath it read "1h 3m actual · 1h 3m OT". The span calculator wrapped
// midnight; the validator did a raw string compare. The wrong one held the Save button.
describe('invalidTimeSpan — the midnight bug', () => {
  it('⭐⭐ 23:08 → 00:11 is a real hour of work, not an error', () => {
    expect(invalidTimeSpan('23:08', '00:11')).toBe(false);
    expect(calcHours('23:08', '00:11')).toBeCloseTo(1.05, 2);   // 1h 3m — what the summary showed
  });

  // ⭐ The validator and the display must never disagree again: anything calcHours can measure is
  // something a person can have worked.
  it('⭐ agrees with calcHours on every span calcHours can measure', () => {
    for (const [s, e] of [['22:00','00:30'], ['14:30','23:00'], ['06:45','15:15'], ['23:59','00:01']]) {
      expect(invalidTimeSpan(s, e), `${s}-${e}`).toBe(false);
      expect(calcHours(s, e), `${s}-${e}`).toBeGreaterThan(0);
    }
  });

  it('⚠️ a ZERO span is the only thing nobody works — calcHours has always said so', () => {
    expect(invalidTimeSpan('23:08', '23:08')).toBe(true);
    expect(calcHours('23:08', '23:08')).toBe(0);
  });

  it('normalises the two time formats, so 06:45 and 06:45:00 are one span', () => {
    expect(invalidTimeSpan('06:45', '06:45:00')).toBe(true);
  });

  // ⚠️ Absence is the required-field check's job. Returning true here would make an empty actual
  // block the save on every ordinary day, which is the opposite of the point.
  it('⚠️ a missing time is not an invalid span', () => {
    expect(invalidTimeSpan(undefined, '00:11')).toBe(false);
    expect(invalidTimeSpan('23:08', undefined)).toBe(false);
    expect(invalidTimeSpan(undefined, undefined)).toBe(false);
  });

  // ⚠️ Deliberate: a typo'd 09:00–08:00 reads as 23h rather than erroring. The summary prints "23h"
  // in front of him, where a refusal printed nothing and blocked a TRUE entry. Loud beats silent.
  it('⚠️ does not reject an implausibly long span — that is the summary\'s job to show', () => {
    expect(invalidTimeSpan('09:00', '08:00')).toBe(false);
    expect(calcHours('09:00', '08:00')).toBe(23);
  });
});
