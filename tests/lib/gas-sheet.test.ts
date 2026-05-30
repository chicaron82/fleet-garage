import { describe, it, expect } from 'vitest';
import { convertToBackendFormat, convertFromBackend, carsFromPageCounter } from '../../src/lib/gas-sheet';

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
});
