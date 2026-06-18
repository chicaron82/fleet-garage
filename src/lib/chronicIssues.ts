import type { Hold, HoldType, Vehicle } from '../types';

/**
 * Chronic released-unrepaired escalation.
 *
 * `releaseStreak` already warns the person *at release* (ReleaseForm) and badges
 * the dashboard — but the signal is spent on that one inline nudge. This lib
 * aggregates it so a car that keeps circulating broken becomes a *pattern* in
 * analytics, not a one-off.
 *
 * Tracked **separately** for mechanical vs damage (Aaron, 2026-06-18): a body
 * dent and a brake fault are different stories, and a mechanical repair must not
 * reset the damage streak. Each category walks only its own holds.
 */

export type ChronicCategory = 'mechanical' | 'damage';

/** Default escalation threshold: 3× released-unrepaired surfaces the vehicle. */
export const CHRONIC_THRESHOLD = 3;

// Which HoldTypes count toward each chronic category. A hold can match both
// (e.g. a collision that's also mechanical) and then counts on both streaks.
// 'detail' / 'sale_car' / 'missing_accessories' are neither — a dirty or
// EV-accessory hold isn't a car "circulating broken".
const CATEGORY_TYPES: Record<ChronicCategory, HoldType[]> = {
  mechanical: ['mechanical'],
  damage:     ['damage', 'hail'],
};

export function holdInCategory(hold: Hold, category: ChronicCategory): boolean {
  const types = hold.holdTypes?.length ? hold.holdTypes : [hold.holdType];
  return types.some(t => CATEGORY_TYPES[category].includes(t));
}

// The shared streak walk: completed holds newest-first, count consecutive
// released-unrepaired. Breaks on a REPAIRED hold (the chain was fixed) or a
// PRE_EXISTING release (accepted damage isn't "unrepaired" — kept from the
// original releaseStreak). VOIDED holds neither count nor break.
function walkStreak(completedNewestFirst: Hold[]): number {
  let count = 0;
  for (const hold of completedNewestFirst) {
    if (hold.status === 'REPAIRED') break;
    if (hold.release?.releaseType === 'PRE_EXISTING') break;
    if (hold.status === 'RELEASED' || hold.status === 'RETURNED') count++;
  }
  return count;
}

const byFlaggedDesc = (a: Hold, b: Hold) =>
  new Date(b.flaggedAt).getTime() - new Date(a.flaggedAt).getTime();

/**
 * Consecutive released-unrepaired holds for a vehicle (all categories combined).
 * Extracted verbatim from VehicleHoldContext so the at-release warning and the
 * dashboard badge keep identical behaviour — now colocated and tested.
 */
export function releaseStreak(holds: Hold[], vehicleId: string): number {
  const completed = holds
    .filter(h => h.vehicleId === vehicleId && h.status !== 'ACTIVE')
    .sort(byFlaggedDesc);
  return walkStreak(completed);
}

/** Released-unrepaired streak for one category only (mechanical or damage). */
export function categoryStreak(holds: Hold[], vehicleId: string, category: ChronicCategory): number {
  const completed = holds
    .filter(h => h.vehicleId === vehicleId && h.status !== 'ACTIVE' && holdInCategory(h, category))
    .sort(byFlaggedDesc);
  return walkStreak(completed);
}

export interface ChronicEntry {
  vehicle: Vehicle;
  mechanical: number;
  damage: number;
  /** max(mechanical, damage) — sort key + "how bad" at a glance. */
  worst: number;
}

/**
 * Vehicles whose mechanical OR damage released-unrepaired streak has crossed the
 * threshold, worst-first. The chronic-issues list.
 */
export function chronicVehicles(
  vehicles: Vehicle[],
  holds: Hold[],
  threshold: number = CHRONIC_THRESHOLD,
): ChronicEntry[] {
  return vehicles
    .map(vehicle => {
      const mechanical = categoryStreak(holds, vehicle.id, 'mechanical');
      const damage     = categoryStreak(holds, vehicle.id, 'damage');
      return { vehicle, mechanical, damage, worst: Math.max(mechanical, damage) };
    })
    .filter(e => e.mechanical >= threshold || e.damage >= threshold)
    .sort((a, b) => b.worst - a.worst);
}
