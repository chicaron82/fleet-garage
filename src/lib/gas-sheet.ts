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
  /** ISO timestamp of when this reading was logged. When present, the most-recently
   *  logged reading wins — a later check-in is authoritative over an earlier preseed
   *  even if the preseed has a higher count (e.g. morning crew carrying forward
   *  yesterday's closing total). */
  loggedAt?: string;
}

/**
 * The most recently logged reading wins when timestamps are available. Without
 * timestamps (test / legacy data), falls back to the highest count — the gas
 * sheet is one continuous document that only grows through the day.
 */
export function latestGasSheetReading(candidates: GasSheetReading[]): GasSheetReading | null {
  if (candidates.length === 0) return null;
  const withTs = candidates.filter(c => c.loggedAt);
  if (withTs.length > 0) {
    return withTs.reduce((best, c) => (c.loggedAt! > best.loggedAt! ? c : best));
  }
  let best: GasSheetReading | null = null;
  let bestCount = -1;
  for (const c of candidates) {
    const count = gasSheetCount(c.fullPages, c.lastPageEntries);
    if (count > bestCount) { bestCount = count; best = c; }
  }
  return best;
}
