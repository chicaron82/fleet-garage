// Which hold a vehicle row should SHOW when the car has several.
//
// Extracted out of HoldsView 2026-08-22 (the file hit the 330 cap adding the backfill card). It was
// always business logic wearing a view's clothes: "which of these records explains the status the
// operator is looking at" is a domain question, and it is now answerable without rendering anything.
import type { Hold, VehicleStatus } from '../types';

/** Most recent activity on a hold — the tiebreak when no status-specific record stands out. */
export type HoldActivity = (h: Hold) => number;

/**
 * The hold that explains this vehicle's status.
 *
 * ⭐ Status-specific first, and that ordering is the point: a car reading PRE_EXISTING must show the
 * hold that was RELEASED as pre-existing, not whichever record happens to be newest. Showing the
 * wrong one makes the row contradict its own badge. Falls back to the most recently touched hold.
 */
export function displayHoldFor(
  holds: readonly Hold[],
  vehicleId: string,
  status: VehicleStatus,
  latestActivity: HoldActivity,
): Hold | undefined {
  const vh = holds.filter(h => h.vehicleId === vehicleId);
  if (vh.length === 0) return undefined;
  if (status === 'HELD')             return vh.find(h => h.status === 'ACTIVE') ?? vh[0];
  if (status === 'PRE_EXISTING')     return vh.find(h => h.release?.releaseType === 'PRE_EXISTING') ?? vh[0];
  if (status === 'OUT_ON_EXCEPTION') return vh.find(h => h.release?.releaseType === 'EXCEPTION') ?? vh[0];
  return [...vh].sort((a, b) => latestActivity(b) - latestActivity(a))[0];
}
