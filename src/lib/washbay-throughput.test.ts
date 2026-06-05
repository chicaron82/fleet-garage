import { describe, it, expect } from 'vitest';
import { sentToFleet } from './washbay-throughput';

// gasSheetCount = fullPages * 19 + lastPageEntries. 2 pages + 5 = 43 cars fuelled.
const base = { fullPages: 2, lastPageEntries: 5, carsRemaining: 0, nonRentablesFuelled: 0, deferredCompletions: 0 };

describe('sentToFleet', () => {
  it('with no adjustments, equals the gas-sheet count', () => {
    expect(sentToFleet(base)).toBe(43);
  });

  it('subtracts the cars still in the queue at close', () => {
    expect(sentToFleet({ ...base, carsRemaining: 5 })).toBe(38);
  });

  it('subtracts non-rentables fuelled but parked (on the sheet, not sent)', () => {
    expect(sentToFleet({ ...base, nonRentablesFuelled: 3 })).toBe(40);
  });

  it('adds deferred completions (sent today, fuelled a prior day)', () => {
    expect(sentToFleet({ ...base, deferredCompletions: 4 })).toBe(47);
  });

  it('applies all three buckets together', () => {
    // 43 − 5 queue − 3 parked + 4 deferred = 39
    expect(sentToFleet({ ...base, carsRemaining: 5, nonRentablesFuelled: 3, deferredCompletions: 4 })).toBe(39);
  });

  it('clamps at 0 — net adjustment cannot go negative', () => {
    expect(sentToFleet({ ...base, carsRemaining: 40, nonRentablesFuelled: 10 })).toBe(0);
  });

  it('a pure deferred day (nothing fuelled) still counts the sent units', () => {
    expect(sentToFleet({ fullPages: 0, lastPageEntries: 0, carsRemaining: 0, nonRentablesFuelled: 0, deferredCompletions: 6 })).toBe(6);
  });
});
