import { describe, it, expect } from 'vitest';
import {
  reducesDenominator,
  splitOffStandard,
  applyShiftWindow,
  computeShiftRates,
  type OffStandardMinutes,
  type ShiftSnapshot,
} from './shift-metrics';

describe('reducesDenominator', () => {
  it('excludes fleeting_sent (cars shipped — already counted in sent-to-fleet)', () => {
    expect(reducesDenominator({ presetReason: 'fleeting_sent' })).toBe(false);
  });
  it('includes plain fleeting_cars (prep that stayed on the lot)', () => {
    expect(reducesDenominator({ presetReason: 'fleeting_cars' })).toBe(true);
  });
  it('includes entries with no preset', () => {
    expect(reducesDenominator({})).toBe(true);
    expect(reducesDenominator({ presetReason: null })).toBe(true);
  });
});

describe('splitOffStandard excludes fleeting_sent', () => {
  const boundary = new Date('2026-06-05T15:15:00');
  const entries: OffStandardMinutes[] = [
    { startTime: '2026-06-05T09:00:00', minutes: 30, presetReason: 'fleeting_cars' }, // morning, reduces
    { startTime: '2026-06-05T10:00:00', minutes: 45, presetReason: 'fleeting_sent' }, // morning, EXEMPT
    { startTime: '2026-06-05T18:00:00', minutes: 20, presetReason: 'fleeting_sent' }, // closing, EXEMPT
    { startTime: '2026-06-05T19:00:00', minutes: 15 },                                // closing, reduces
  ];

  it('counts only denominator-reducing minutes per window', () => {
    expect(splitOffStandard(entries, boundary)).toEqual({ morning: 30, closing: 15 });
  });

  it('with no boundary, sums only reducible minutes into morning', () => {
    expect(splitOffStandard(entries, null)).toEqual({ morning: 45, closing: 0 });
  });
});

describe('applyShiftWindow excludes fleeting_sent from the window OTH', () => {
  const snapshot: ShiftSnapshot = { cleaned: 24, hours: 8, oth: 0 };
  const entries: OffStandardMinutes[] = [
    { startTime: '2026-06-05T17:00:00', minutes: 60, presetReason: 'fleeting_sent' }, // in window, EXEMPT
    { startTime: '2026-06-05T18:00:00', minutes: 30, presetReason: 'fleeting_cars' }, // in window, reduces
  ];

  it('only the non-sent fleeting time reduces the denominator', () => {
    const out = applyShiftWindow(snapshot, {
      date: '2026-06-05',
      actualStart: '16:00', actualEnd: '20:00',
      offStandardEntries: entries,
    });
    expect(out.oth).toBe(30); // 60 fleeting_sent minutes excluded

    // 4h clock, no break (span < 5h) → 4h; effort = 24 / (4 − 30/60) = 24 / 3.5
    const { yourEffort } = computeShiftRates(out);
    expect(yourEffort).toBeCloseTo(24 / 3.5, 5);
  });
});
