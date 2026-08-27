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

/**
 * Everything ever found in this car, split by whether it is still ours to deal with.
 *
 * Aaron, 2026-08-27: *"what happens to items that have been tossed or marked as returned. do they
 * stay on the record as at some point in time an item was found or does it get removed completely"*
 *
 * ⚠️ Neither, until now. The ROW was never deleted — `lost_found` keeps all of them — but the vehicle
 * section filtered to the unresolved ones, so returning or tossing an item made it **vanish from that
 * car's record** and live only in the L&F module. The cleared-note shape a night earlier, exactly:
 * the data kept, nothing rendering it. A customer rings about a bag left in a car and the car's own
 * record says nothing.
 *
 * ⭐ His design, and it is the same reveal-don't-choose move as the sightings chip and the note
 * history: *"if/when returned the l&f on the record collapses. if another item is found later down
 * the line it would show the current found and keep the previous item collapsed from view which can
 * still be expanded if needed."* The record leads with what is live and keeps the rest one tap away —
 * so the section stops meaning *"what is in our possession"* and starts meaning *"what this car has
 * produced"*, without getting noisier on the common car.
 */
export interface VehicleLostFound {
  /** Still ours to act on — rendered open, as before. */
  active: LostFoundItem[];
  /** Returned or disposed — collapsed, newest first, never dropped. */
  resolved: LostFoundItem[];
}

export function lostFoundHistoryForVehicle(
  items: LostFoundItem[],
  vehicle: { licensePlate: string; unitNumber: string | null },
): VehicleLostFound {
  const plate = vehicle.licensePlate.trim().toUpperCase();
  const unit = vehicle.unitNumber?.trim().toUpperCase() || null;
  const mine = items.filter(i => {
    const ip = i.licensePlate?.trim().toUpperCase();
    const iu = i.unitNumber?.trim().toUpperCase();
    return (!!ip && ip === plate) || (!!unit && !!iu && iu === unit);
  });
  // ⚠️ Newest first, sorted HERE rather than trusting the caller's order — a history whose order
  // depends on however the context happened to load is a bug waiting for someone to change the query.
  const byNewest = (a: LostFoundItem, b: LostFoundItem) => (a.foundAt < b.foundAt ? 1 : -1);
  return {
    active:   mine.filter(i => UNRESOLVED.includes(i.status)).sort(byNewest),
    resolved: mine.filter(i => !UNRESOLVED.includes(i.status)).sort(byNewest),
  };
}
