import type { HoldType } from '../types';

/** Canonical display labels for hold types. Shared so the flag form, hold history,
 *  per-issue resolution, exports and reports all read one source. */
export const HOLD_TYPE_LABELS: Record<HoldType, string> = {
  damage:              'Damage',
  hail:                'Hail',
  detail:              'Detail',
  mechanical:          'Mechanical',
  sale_car:            'Sale Car',
  // ⚠️ "Assets", matching the EV Assets ⚡ tab this type is created from (a Tesla missing its mobile cable
  // or J1772 adapter). It said "Accessories" here while the Holds badge said "Assets" — two names for one
  // hold (2026-09-14). The DB value stays `missing_accessories`; only the word he reads changed.
  missing_accessories: 'Missing Assets',
};

/** Look up a hold type label from a raw DB string, with a title-case fallback. */
export function holdTypeLabel(t: string): string {
  return (HOLD_TYPE_LABELS as Record<string, string>)[t] ?? (t.charAt(0).toUpperCase() + t.slice(1));
}
