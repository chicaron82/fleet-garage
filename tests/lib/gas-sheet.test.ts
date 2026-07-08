import { describe, it, expect } from 'vitest';
import {
  convertToBackendFormat,
  convertFromBackend,
  carsFromPageCounter,
  gasSheetCount,
  latestGasSheetReading,
  hasGasSheetData,
  ENTRIES_PER_PAGE,
} from '../../src/lib/gas-sheet';

// Page counter: 19 entries per full page. The UI counts "total pages" + "entries
// on the current page"; the backend stores "full pages" + "last page entries".

describe('convertToBackendFormat', () => {
  it('zero pages → entries land on the (zeroth) last page', () => {
    expect(convertToBackendFormat(0, 5)).toEqual({ fullPages: 0, lastPageEntries: 5 });
  });

  it('a fresh empty page → that page is not yet a full page', () => {
    expect(convertToBackendFormat(3, 0)).toEqual({ fullPages: 3, lastPageEntries: 0 });
  });

  it('partial current page → fullPages is one less, remainder on last', () => {
    expect(convertToBackendFormat(3, 7)).toEqual({ fullPages: 2, lastPageEntries: 7 });
  });
});

describe('convertFromBackend', () => {
  it('empty → zero pages', () => {
    expect(convertFromBackend(0, 0)).toEqual({ totalPages: 0, entriesOnCurrentPage: 0 });
  });

  it('only last-page entries → a single page', () => {
    expect(convertFromBackend(0, 5)).toEqual({ totalPages: 1, entriesOnCurrentPage: 5 });
  });

  it('only full pages → no partial page', () => {
    expect(convertFromBackend(3, 0)).toEqual({ totalPages: 3, entriesOnCurrentPage: 0 });
  });

  it('full pages + remainder → totalPages adds the partial page back', () => {
    expect(convertFromBackend(2, 7)).toEqual({ totalPages: 3, entriesOnCurrentPage: 7 });
  });
});

describe('round-trip (UI → backend → UI)', () => {
  // Canonical UI inputs survive the round trip unchanged.
  it.each([
    [3, 0],
    [3, 7],
    [1, 1],
  ])('totalPages=%i, entries=%i survives the round trip', (totalPages, entries) => {
    const back = convertToBackendFormat(totalPages, entries);
    expect(convertFromBackend(back.fullPages, back.lastPageEntries))
      .toEqual({ totalPages, entriesOnCurrentPage: entries });
  });

  it('normalizes the degenerate "0 pages but N entries" input to a single page', () => {
    // You can't have entries on page zero — the backend representation collapses
    // (0, 5) to one page of 5, which reads back as (1 page, 5 entries).
    const back = convertToBackendFormat(0, 5);
    expect(convertFromBackend(back.fullPages, back.lastPageEntries))
      .toEqual({ totalPages: 1, entriesOnCurrentPage: 5 });
  });
});

describe('carsFromPageCounter', () => {
  it('counts 19 per full page plus the remainder', () => {
    expect(carsFromPageCounter(3, 7)).toBe(45); // → {2,7} → 2*19 + 7
  });

  it('counts a single partial page', () => {
    expect(carsFromPageCounter(0, 5)).toBe(5);
  });

  it('counts whole pages exactly', () => {
    expect(carsFromPageCounter(2, 0)).toBe(38); // → {2,0} → 2*19
  });

  it('matches gasSheetCount on the converted backend reading', () => {
    // carsFromPageCounter converts UI→backend first, so (3,10) → (2,10).
    expect(carsFromPageCounter(3, 10)).toBe(gasSheetCount(2, 10));
    expect(carsFromPageCounter(0, 0)).toBe(0);
  });
});

describe('gasSheetCount', () => {
  it('combines full pages and last-page entries', () => {
    expect(gasSheetCount(0, 0)).toBe(0);
    expect(gasSheetCount(2, 18)).toBe(2 * ENTRIES_PER_PAGE + 18);
    expect(gasSheetCount(3, 10)).toBe(67);
  });
});

describe('latestGasSheetReading', () => {
  it('returns null when there are no candidates', () => {
    expect(latestGasSheetReading([])).toBeNull();
  });

  it('handles a single candidate', () => {
    expect(latestGasSheetReading([{ fullPages: 2, lastPageEntries: 18 }]))
      .toEqual({ fullPages: 2, lastPageEntries: 18 });
  });

  // ── The furthest-along reading of the day wins (highest count) ────────────
  // The gas sheet only grows through the day, so the highest count is always the
  // most advanced position — regardless of when each reading was typed into the
  // app. loggedAt is deliberately NOT a tie-break (it's data-entry time, not the
  // gas-sheet clock time).

  it('picks the highest count, not the most recently logged', () => {
    // Aaron's real workflow: a handoff read off the timestamped card gets typed in
    // LATE — after a higher departure count is already logged. The stale, lower
    // handoff must NOT win just because its loggedAt is more recent.
    const result = latestGasSheetReading([
      { fullPages: 2, lastPageEntries: 8, loggedAt: '2026-07-07T23:10:00.000Z' }, // departure, 46 — logged first
      { fullPages: 1, lastPageEntries: 13, loggedAt: '2026-07-07T23:40:00.000Z' }, // handoff, 32 — entered LATE
    ]);
    expect(result).toMatchObject({ fullPages: 2, lastPageEntries: 8 }); // 46 wins
  });

  it('highest count wins across three same-day readings whatever the log order', () => {
    // Aaron's worked example: arrival 15 → handoff 32 → departure 46, cleanly
    // increasing, but suppose they were keyed in out of order.
    const result = latestGasSheetReading([
      { fullPages: 2, lastPageEntries: 8,  loggedAt: '2026-07-07T20:00:00.000Z' }, // departure 46 ← highest, logged earliest
      { fullPages: 0, lastPageEntries: 15, loggedAt: '2026-07-07T21:00:00.000Z' }, // arrival 15, logged later
      { fullPages: 1, lastPageEntries: 13, loggedAt: '2026-07-07T22:00:00.000Z' }, // handoff 32, logged latest
    ]);
    expect(result).toMatchObject({ fullPages: 2, lastPageEntries: 8 }); // 46 wins
  });

  it('picks the highest count when no candidates have timestamps', () => {
    const result = latestGasSheetReading([
      { fullPages: 3, lastPageEntries: 10 }, // 67
      { fullPages: 2, lastPageEntries: 18 }, // 56
      { fullPages: 1, lastPageEntries: 0 },  // 19
    ]);
    expect(result).toEqual({ fullPages: 3, lastPageEntries: 10 });
  });

  it('ignores lower readings regardless of list order', () => {
    const result = latestGasSheetReading([
      { fullPages: 4, lastPageEntries: 2 },  // 78
      { fullPages: 2, lastPageEntries: 0 },  // 38
    ]);
    expect(result).toEqual({ fullPages: 4, lastPageEntries: 2 });
  });

  it('a single timestamped candidate is returned directly', () => {
    expect(latestGasSheetReading([{ fullPages: 2, lastPageEntries: 18, loggedAt: '2026-06-16T12:00:00.000Z' }]))
      .toMatchObject({ fullPages: 2, lastPageEntries: 18 });
  });
});

// The gate that decides whether the closing form locks into its read-only summary
// (isRealClose) or stays editable. A finalized close has gas-sheet data; a
// handoff/backfill placeholder row (0/0) does not.
describe('hasGasSheetData', () => {
  it('a placeholder/backfill row (0/0) is not a close → form stays editable', () => {
    expect(hasGasSheetData({ fullPages: 0, lastPageEntries: 0 })).toBe(false);
  });

  it('a finalized close with full pages is a close → summary shown', () => {
    expect(hasGasSheetData({ fullPages: 3, lastPageEntries: 10 })).toBe(true);
  });

  it('a thin-but-real close on page 1 only (e.g. 7 cars all day) still counts', () => {
    expect(hasGasSheetData({ fullPages: 0, lastPageEntries: 7 })).toBe(true);
  });

  it('a not-yet-loaded today-log (null/undefined) is not a close', () => {
    expect(hasGasSheetData(null)).toBe(false);
    expect(hasGasSheetData(undefined)).toBe(false);
  });
});
