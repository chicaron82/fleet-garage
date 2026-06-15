import type { HoldType } from '../types';

/** Canonical display labels for hold types. Shared so the flag form, hold history,
 *  per-issue resolution, exports and reports all read one source. */
export const HOLD_TYPE_LABELS: Record<HoldType, string> = {
  damage:              'Damage',
  hail:                'Hail',
  detail:              'Detail',
  mechanical:          'Mechanical',
  sale_car:            'Sale Car',
  missing_accessories: 'Missing Accessories',
};

/** Look up a hold type label from a raw DB string, with a title-case fallback. */
export function holdTypeLabel(t: string): string {
  return (HOLD_TYPE_LABELS as Record<string, string>)[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
}
