import { describe, it, expect } from 'vitest';
import {
  reducesDenominator,
  splitOffStandard,
  applyShiftWindow,
  buildShiftPartition,
  computeShiftRates,
  type OffStandardMinutes,
  type ShiftSnapshot,
} from './shift-metrics';
import { sentToFleet, type SentToFleetInput } from './washbay-throughput';

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

// handoff: 2 full pages + 2 entries = 2*19+2 = 40 cars on the gas sheet
const HANDOFF_40 = {
  fullPages: 2, lastPageEntries: 2,
  loggedAt: '2026-06-05T15:15:00',
  morningHours: 8,
};

describe('buildShiftPartition — carryOverCleared credits morning, keeps closing boundary on morningGas', () => {
  it('with carryOverCleared=5: morning.cleaned=45, closing.cleaned=20 (boundary = 40, not 45)', () => {
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(45);  // 40 gas + 5 carry-over credited to morning
    expect(result.closing.cleaned).toBe(20);  // 60 − 40 (morningGas boundary, not 45)
  });

  it('daily total = fullDayCleaned + carryOverCleared (carry-over not double-subtracted)', () => {
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned! + result.closing.cleaned!).toBe(65); // 60 + 5
  });

  it('with no carryOverCleared (omitted): partition unchanged from Phase 1 behaviour', () => {
    const result = buildShiftPartition({
      handoff: HANDOFF_40,
      checkpoint: null,
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(40);
    expect(result.closing.cleaned).toBe(20);
    expect(result.morning.cleaned! + result.closing.cleaned!).toBe(60);
  });

  it('checkpoint overrides morningGas as closing boundary even with carryOverCleared', () => {
    // checkpoint at 45 cars; carryOverCleared=5 → morningCleaned=45, but boundary=45 from checkpoint
    const result = buildShiftPartition({
      handoff: { ...HANDOFF_40, carryOverCleared: 5 },
      checkpoint: { fullPages: 2, lastPageEntries: 7, loggedAt: '2026-06-05T16:00:00' }, // 2*19+7=45
      fullDayCleaned: 60,
      offStandardEntries: [],
    });
    expect(result.morning.cleaned).toBe(45);  // 40 + 5 carry-over
    expect(result.closing.cleaned).toBe(15);  // 60 − 45 (checkpoint boundary wins)
  });
});

// The seam ShiftRatesCard wires: sentToFleet(log) → fullDayCleaned → partition.
// buildShiftPartition's own tests pass fullDayCleaned as a literal; nothing pins
// that the literal is the *corrected* sent-to-fleet number. These tests compose
// the two pure functions so a change to either side (a dropped sentToFleet term,
// or the partition recomputing instead of consuming) breaks here, not in prod.
describe('sentToFleet → buildShiftPartition seam', () => {
  // 3 pages + 0 = 57 fuelled; − 8 queue − 3 parked + 4 deferred = 50 sent.
  const LOG: SentToFleetInput = {
    fullPages: 3, lastPageEntries: 0,
    carsRemaining: 8, nonRentablesFuelled: 3, deferredCompletions: 4,
  };
  const closingClean = (over: Partial<SentToFleetInput> = {}) =>
    buildShiftPartition({
      handoff: HANDOFF_40,                 // morningGas boundary = 40
      checkpoint: null,
      fullDayCleaned: sentToFleet({ ...LOG, ...over }),
      offStandardEntries: [],
    }).closing.cleaned;

  it('closing.cleaned tracks the net-shipped number, not the raw gas count', () => {
    expect(sentToFleet(LOG)).toBe(50);
    expect(closingClean()).toBe(10);            // 50 sent − 40 boundary
    expect(closingClean()).not.toBe(57 - 40);   // the corrections flow through, not raw 57
  });

  it('every sentToFleet correction moves closing.cleaned one-for-one', () => {
    expect(closingClean({ deferredCompletions: 5 })).toBe(11); // +1 deferred → +1 shipped
    expect(closingClean({ carsRemaining: 9 })).toBe(9);        // +1 left in queue → −1 shipped
    expect(closingClean({ nonRentablesFuelled: 4 })).toBe(9);  // +1 parked → −1 shipped
  });

  it('the corrected number reaches the rate (chain end to end)', () => {
    const closing = buildShiftPartition({
      handoff: HANDOFF_40, checkpoint: null,
      fullDayCleaned: sentToFleet(LOG), offStandardEntries: [],
    }).closing;
    // 10 sent in the closing window / 8h — not 17/8 had raw gas leaked through.
    expect(computeShiftRates(closing).baseline).toBeCloseTo(10 / 8, 5);
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
