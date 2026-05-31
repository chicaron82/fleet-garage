import { describe, it, expect } from 'vitest';
import {
  convertToBackendFormat,
  convertFromBackend,
  carsFromPageCounter,
  gasSheetCount,
  latestGasSheetReading,
  ENTRIES_PER_PAGE,
} from './gas-sheet';

describe('gasSheetCount', () => {
  it('combines full pages and last-page entries', () => {
    expect(gasSheetCount(0, 0)).toBe(0);
    expect(gasSheetCount(2, 18)).toBe(2 * ENTRIES_PER_PAGE + 18);
    expect(gasSheetCount(3, 10)).toBe(67);
  });
});

describe('carsFromPageCounter', () => {
  it('matches gasSheetCount on the converted backend reading', () => {
    // 3 total pages, 10 on the current page → 2 full pages + 10 = 48
    expect(carsFromPageCounter(3, 10)).toBe(gasSheetCount(2, 10));
    expect(carsFromPageCounter(0, 0)).toBe(0);
  });
});

describe('convert round-trip', () => {
  it('survives a round-trip through the backend format', () => {
    for (const [tp, ep] of [[0, 0], [1, 0], [0, 5], [3, 10], [2, 19]] as const) {
      const back = convertToBackendFormat(tp, ep);
      const ui = convertFromBackend(back.fullPages, back.lastPageEntries);
      expect(carsFromPageCounter(ui.totalPages, ui.entriesOnCurrentPage))
        .toBe(carsFromPageCounter(tp, ep));
    }
  });
});

describe('latestGasSheetReading', () => {
  it('returns null when there are no candidates', () => {
    expect(latestGasSheetReading([])).toBeNull();
  });

  it('picks the furthest-along reading, not the last in the list', () => {
    const result = latestGasSheetReading([
      { fullPages: 3, lastPageEntries: 10 }, // 67 — the check-in
      { fullPages: 2, lastPageEntries: 18 }, // 56 — an earlier reading
      { fullPages: 1, lastPageEntries: 0 },  // 19
    ]);
    expect(result).toEqual({ fullPages: 3, lastPageEntries: 10 });
  });

  it('ignores lower readings even when they appear last (sheet only grows)', () => {
    const result = latestGasSheetReading([
      { fullPages: 4, lastPageEntries: 2 },  // 78
      { fullPages: 2, lastPageEntries: 0 },  // 38 — a stale/corrected entry
    ]);
    expect(result).toEqual({ fullPages: 4, lastPageEntries: 2 });
  });

  it('handles a single candidate', () => {
    expect(latestGasSheetReading([{ fullPages: 2, lastPageEntries: 18 }]))
      .toEqual({ fullPages: 2, lastPageEntries: 18 });
  });
});
