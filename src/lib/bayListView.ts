// What the bay list shows, and in what order (docs/ticket-bay-list-chip-filters-fold-newest-first.md).
//
// Aaron, 2026-11-04, 57 cars into the day: *"Filters to show M, B, Erin. And instead of a giant list to scroll after 4 it
// just shows the last 3 cleaned the rest are collapsed."* Then: *"Read-only gets the chips but not the fold. Display in
// reverse order most recent cleaned at the top"*.
import type { BayLine, BayLineKind } from './lotBayLog';

/** The chips that filter. Clean is most of the list, and "still to do" is a count, so neither filters. */
export type BayFilter = Extract<BayLineKind, 'mhold' | 'bhold' | 'erin'>;
export const BAY_FILTERS: readonly BayFilter[] = ['bhold', 'mhold', 'erin'];

/** Finished cars shown above the fold. */
export const FOLD_KEEP = 3;

export interface BayListView {
  /** Shown, newest first. */
  shown: BayLine[];
  /** Behind "▾ N earlier", newest first. Always empty when nothing folds. */
  folded: BayLine[];
}

/**
 * Newest first, filtered, then folded.
 *
 * - The car in the bay is the newest line, so it leads.
 * - A filter shows every line of its kind, never folded: there are only ever a handful.
 * - The fold (FG only) keeps the last {@link FOLD_KEEP} finished cars once there are 4 or more. Two kinds of line
 *   never fold: the car in the bay, and `pinned` (an M / B row still waiting on Flag it), which sits just under the
 *   three so a to-do can't hide behind a fold he would have to remember to open.
 */
export function bayListView(lines: readonly BayLine[], { filter = null, fold = false, pinned = new Set<number>() }: {
  filter?: BayFilter | null; fold?: boolean; pinned?: ReadonlySet<number>;
} = {}): BayListView {
  const newest = [...lines].reverse();
  if (filter) return { shown: newest.filter(l => l.kind === filter), folded: [] };
  const finished = newest.filter(l => l.kind !== 'bay');
  if (!fold || finished.length <= FOLD_KEEP) return { shown: newest, folded: [] };
  const kept = new Set(finished.slice(0, FOLD_KEEP).map(l => l.id));
  const top = newest.filter(l => l.kind === 'bay' || kept.has(l.id));
  const rest = finished.slice(FOLD_KEEP);
  return { shown: [...top, ...rest.filter(l => pinned.has(l.id))], folded: rest.filter(l => !pinned.has(l.id)) };
}
