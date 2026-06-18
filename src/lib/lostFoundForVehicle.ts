import type { LostFoundItem, LostFoundStatus } from '../types';

/** Still in our possession — surfaced on the vehicle. Returned/disposed are done. */
const UNRESOLVED: LostFoundStatus[] = ['holding', 'customer_contacted'];

/**
 * Unresolved Lost & Found items found in a given vehicle — matched by plate OR
 * unit number (the item records both; either identifying the car is enough).
 * Case-insensitive. Resolved (returned / disposed) items are excluded so the
 * active vehicle view stays clean; items found in a non-fleet plate simply don't
 * match any vehicle and keep living in the L&F view.
 */
export function lostFoundForVehicle(
  items: LostFoundItem[],
  vehicle: { licensePlate: string; unitNumber: string | null },
): LostFoundItem[] {
  const plate = vehicle.licensePlate.trim().toUpperCase();
  const unit = vehicle.unitNumber?.trim().toUpperCase() || null;
  return items.filter(i => {
    if (!UNRESOLVED.includes(i.status)) return false;
    const ip = i.licensePlate?.trim().toUpperCase();
    const iu = i.unitNumber?.trim().toUpperCase();
    return (!!ip && ip === plate) || (!!unit && !!iu && iu === unit);
  });
}
