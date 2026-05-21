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

export function carsFromPageCounter(totalPages: number, entriesOnCurrentPage: number): number {
  const { fullPages, lastPageEntries } = convertToBackendFormat(totalPages, entriesOnCurrentPage);
  return fullPages * 19 + lastPageEntries;
}
