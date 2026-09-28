import type { Hold, Vehicle } from '../types';

/**
 * Cars carrying an ACTIVE hold while their stored status reads CLEAR — the one shape that hides a
 * hold from the Holds list, which lists CARS by status and drops CLEAR ones (useHoldsWorklist).
 *
 * ⚠️ WHY (Aaron, 2026-09-28): LUR479 and LUR538 sat invisible for 15 days with live PM-due holds. He
 * found them only by chance, logging odometers: *"it came up as PM due, and i was like i thought i
 * cleared all the PM vehicles held."* A script had written the holds and skipped the second step
 * (`vehicles.status → HELD`); the app's own `addHold` could leave the same shape if that second
 * write fails on a bad signal. This catches it however it happened.
 *
 * ⚠️ Deliberately NARROW — only CLEAR with an active hold. A general "stored status ≠ derived status"
 * check would also flag sale cars and exceptions whose status is decided elsewhere, and a warning
 * that cries wolf is one he learns to scroll past.
 */
export function carsHiddenFromHolds(vehicles: readonly Vehicle[], holds: readonly Hold[]): Vehicle[] {
  const withActive = new Set(holds.filter(h => h.status === 'ACTIVE').map(h => h.vehicleId));
  return vehicles.filter(v => v.status === 'CLEAR' && withActive.has(v.id));
}
