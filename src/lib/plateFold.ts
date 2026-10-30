// O and 0 are one key when a plate is TYPED. Aaron, 2026-10-29, on the bay log's Find a car: 0GK487 is the plate that
// gets typed OGK487 (a zero and a letter O look the same on a tag and sit apart on a phone keyboard).
// docs/ticket-bay-find-a-car-inline-search.md.
//
// ⚠️ A SEARCH tolerance, never a rewrite. What he typed is still what he typed (VehicleLookup: "typed, therefore never
// corrected"); this only widens what the look-up FINDS, the same way the contains-match did.

/** Every O read as 0, case-blind: two keys compare equal when they differ only by O/0. */
export function foldOZero(s: string): string {
  return s.toUpperCase().replace(/O/g, '0');
}

/**
 * The spellings a search asks the database for: as typed, every O as 0, every 0 as O (deduped, in that order).
 * ⚠️ A plate holding BOTH an O and a 0 is found only if he types those two spots right; whole-swaps keep the query
 * exact rather than widening every O/0 to "any character", which would flood a short query.
 */
export function oZeroVariants(q: string): string[] {
  const up = q.toUpperCase();
  return [...new Set([up, up.replace(/O/g, '0'), up.replace(/0/g, 'O')])];
}
