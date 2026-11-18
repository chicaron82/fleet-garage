import { foldOZero } from './plateFold';

/** The two keys a car is looked up by. `Vehicle` fits as it is. */
export interface CarKeys {
  id: string;
  licensePlate: string;
  unitNumber?: string | null;
}

const norm = (s: string) => foldOZero(s.replace(/[^A-Za-z0-9]/g, ''));

/**
 * The one car a search names IN FULL: its whole plate, or its whole unit number. Null when the text names no car, or
 * more than one (a mock beside the real car, a re-plate duplicate: FG never picks between those on its own).
 *
 * ⭐ Why it exists (2026-11-18, docs/ticket-recent-cars-everywhere-and-restore-from-find.md). Aaron, in Fleet: *"it
 * doesn't show my last search. So I have to retype it"*. Fleet and Holds are FILTERS, not pickers: nothing is ever
 * "chosen", so there was no moment to remember a car. A full plate or unit is that moment, the search has landed on one
 * car. "LUR5" lands on nothing, so a half-typed search never fills his recents with noise.
 *
 * Folded like every other typed plate in FG (plateFold.ts): O and 0 are one key under a thumb.
 */
export function exactCarId(term: string, cars: readonly CarKeys[]): string | null {
  const t = norm(term);
  if (t.length < 2) return null;
  const hits = cars.filter(c => norm(c.licensePlate) === t || (!!c.unitNumber && norm(c.unitNumber) === t));
  return hits.length === 1 ? hits[0].id : null;
}
