export function convertToBackendFormat(
  totalPages: number,
  entriesOnCurrentPage: number,
): { fullPages: number; lastPageEntries: number } {
  if (totalPages === 0) return { fullPages: 0, lastPageEntries: entriesOnCurrentPage };
  if (entriesOnCurrentPage === 0) return { fullPages: totalPages, lastPageEntries: 0 };
  return { fullPages: totalPages - 1, lastPageEntries: entriesOnCurrentPage };
}

export function convertFromBackend(
  fullPages: number,
  lastPageEntries: number,
): { totalPages: number; entriesOnCurrentPage: number } {
  if (fullPages === 0 && lastPageEntries === 0) return { totalPages: 0, entriesOnCurrentPage: 0 };
  if (fullPages === 0) return { totalPages: 1, entriesOnCurrentPage: lastPageEntries };
  if (lastPageEntries === 0) return { totalPages: fullPages, entriesOnCurrentPage: 0 };
  return { totalPages: fullPages + 1, entriesOnCurrentPage: lastPageEntries };
}

/** Entries per full gas-sheet page. */
export const ENTRIES_PER_PAGE = 19;

/** Cumulative car count from a backend-format reading (full pages + entries on the current page). */
export function gasSheetCount(fullPages: number, lastPageEntries: number): number {
  return fullPages * ENTRIES_PER_PAGE + lastPageEntries;
}

export function carsFromPageCounter(totalPages: number, entriesOnCurrentPage: number): number {
  const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
  return gasSheetCount(fullPages, lastPageEntries);
}

export interface GasSheetReading {
  fullPages: number;
  lastPageEntries: number;
}

/**
 * The furthest-along reading wins. The gas sheet is one continuous document
 * that only grows through the day, so the highest cumulative count across the
 * day's checkpoints is "where the sheet stands now" — the right place for the
 * next checkpoint to pick up from instead of recounting from zero.
 */
export function latestGasSheetReading(candidates: GasSheetReading[]): GasSheetReading | null {
  let best: GasSheetReading | null = null;
  let bestCount = -1;
  for (const c of candidates) {
    const count = gasSheetCount(c.fullPages, c.lastPageEntries);
    if (count > bestCount) {
      bestCount = count;
      best = { fullPages: c.fullPages, lastPageEntries: c.lastPageEntries };
    }
  }
  return best;
}
