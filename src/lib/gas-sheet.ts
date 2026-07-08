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

/**
 * A washbay_log row counts as a finalized close only when it carries real
 * gas-sheet data. A backfill/placeholder row (fullPages=0, lastPageEntries=0 —
 * e.g. a prior-shift backfill stub) is not a close, so the closing form must
 * stay editable rather than locking into the read-only summary.
 */
export function hasGasSheetData(
  reading: { fullPages: number; lastPageEntries: number } | null | undefined,
): boolean {
  return !!reading && (reading.fullPages > 0 || reading.lastPageEntries > 0);
}

export interface GasSheetReading {
  fullPages: number;
  lastPageEntries: number;
  /** ISO timestamp of when this reading was logged into the app (data-entry time,
   *  NOT the gas-sheet clock time). Used elsewhere to bucket a reading to its
   *  business date; it is deliberately NOT used to pick the furthest-along reading
   *  — see latestGasSheetReading. */
  loggedAt?: string;
}

/**
 * The furthest-along reading of the day wins — the one with the highest gas-sheet
 * count. The gas sheet is one continuous document that only grows through the day,
 * so the highest count is always the most advanced position, regardless of when
 * each reading happened to be typed into the app.
 *
 * We deliberately do NOT tie-break on `loggedAt`: a checkpoint entered LATE but
 * anchored to an earlier gas-sheet moment (Aaron's real workflow — he reads the
 * correct count off the timestamped card whenever he gets a chance) must not
 * regress the seed below a higher count already logged. Callers are responsible
 * for scoping candidates to a single business day (the only caller already
 * same-day-filters), so cross-day leakage can't occur here.
 */
export function latestGasSheetReading(candidates: GasSheetReading[]): GasSheetReading | null {
  let best: GasSheetReading | null = null;
  let bestCount = -1;
  for (const c of candidates) {
    const count = gasSheetCount(c.fullPages, c.lastPageEntries);
    if (count > bestCount) { bestCount = count; best = c; }
  }
  return best;
}
