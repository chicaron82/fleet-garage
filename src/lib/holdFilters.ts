import type { Hold, HoldType, Vehicle } from '../types';

export const STALE_HOLD_MS = 48 * 60 * 60 * 1000;

export function isStaleHold(hold: Hold, now = Date.now()): boolean {
  return (
    hold.status === 'ACTIVE' &&
    now - new Date(hold.flaggedAt).getTime() > STALE_HOLD_MS
  );
}

/**
 * The My Day "held too long" metric: distinct vehicles that are actually being HELD
 * — the same population the sidebar Holds badge counts (status HELD; the caller
 * passes the already branch-scoped, non-archived vehicle list) — AND that carry a
 * stale hold. Scoping to the held set keeps the count honest: a `sale_car` hold on a
 * SALE_CAR vehicle, or a dangling hold on an archived unit, is NOT "held too long in
 * the bay", and this guarantees the number never exceeds the badge.
 */
export function staleHeldVehicleCount(staleHolds: Hold[], vehicles: Vehicle[]): number {
  const heldIds = new Set(vehicles.filter(v => v.status === 'HELD').map(v => v.id));
  const held = new Set<string>();
  for (const h of staleHolds) if (heldIds.has(h.vehicleId)) held.add(h.vehicleId);
  return held.size;
}

/**
 * Active holds whose still-unresolved types overlap the types being flagged —
 * the strongest duplicate-flag signal the form can show BEFORE submit. A type
 * already resolved within a multi-type hold (per-issue resolution) doesn't
 * count: that issue is fixed, so a fresh flag of it is legitimately new.
 * Advisory only — informs the flagger, never blocks (a vehicle can genuinely
 * carry two active damage holds for two different scrapes).
 */
export function findActiveTypeOverlap(
  activeHolds: Hold[],
  selectedTypes: HoldType[],
): { hold: Hold; types: HoldType[] }[] {
  return activeHolds
    .map(hold => ({
      hold,
      types: selectedTypes.filter(t =>
        hold.holdTypes.includes(t) && !(hold.resolvedTypes ?? []).includes(t)
      ),
    }))
    .filter(o => o.types.length > 0);
}
