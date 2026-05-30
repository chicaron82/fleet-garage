import type { VehicleStatus } from '../types';

/**
 * Single source of truth for deriving a vehicle's status from its holds.
 *
 * Both the read path (`buildFleetView`, over raw hold rows) and the write path
 * (`useVehicleOperations`, over domain `Hold` objects) feed their holds through
 * `factsFromRow` / `factsFromHold` into the same `deriveHoldStatus` cascade, so
 * the fleet master list and the stored `vehicle.status` can no longer drift.
 *
 * Priority cascade (highest wins):
 *   held               — any ACTIVE non-sale-car hold (vehicle is grounded)
 *   sale-car           — any ACTIVE sale_car hold
 *   auction-short-term — a sale_car released on an open EXCEPTION (going to auction)
 *   pre-existing       — a hold released as PRE_EXISTING (damage accepted as-is)
 *   on-exception       — a hold released on an open EXCEPTION or MECHANICAL_RELEASE
 *   clear              — none of the above
 *
 * Auction beats pre-existing: a car going to auction as-is shows its auction
 * status regardless of accepted pre-existing damage. Pre-existing is a release
 * decision, never a hold type — it's detected from the release record.
 */

export type HoldDerivedStatus =
  | 'held'
  | 'sale-car'
  | 'auction-short-term'
  | 'pre-existing'
  | 'on-exception'
  | 'clear';

export interface HoldFacts {
  /** Hold is currently ACTIVE — actively grounding the vehicle. */
  isActive: boolean;
  /** `hold_types` includes 'sale_car'. */
  isSaleCar: boolean;
  /** Released on an EXCEPTION that has not yet returned (still out). */
  isOpenException: boolean;
  /** Released on an open MECHANICAL_RELEASE (out for mechanical work, expected back). */
  isOpenMechanical: boolean;
  /** Released as PRE_EXISTING — damage accepted, vehicle stays in circulation. */
  isPreExisting: boolean;
}

export function deriveHoldStatus(facts: HoldFacts[]): HoldDerivedStatus {
  if (facts.some(f => f.isActive && !f.isSaleCar))   return 'held';
  if (facts.some(f => f.isActive && f.isSaleCar))    return 'sale-car';
  if (facts.some(f => f.isOpenException && f.isSaleCar)) return 'auction-short-term';
  if (facts.some(f => f.isPreExisting))              return 'pre-existing';
  if (facts.some(f => f.isOpenException || f.isOpenMechanical)) return 'on-exception';
  return 'clear';
}

/** Map the shared status to the stored `VehicleStatus` enum (write path). */
export function toVehicleStatus(status: HoldDerivedStatus): VehicleStatus {
  switch (status) {
    case 'held':               return 'HELD';
    case 'sale-car':           return 'SALE_CAR';
    case 'auction-short-term': return 'AUCTION_SHORT_TERM';
    case 'pre-existing':       return 'PRE_EXISTING';
    case 'on-exception':       return 'OUT_ON_EXCEPTION';
    case 'clear':              return 'CLEAR';
  }
}

/** Facts from a raw hold row (read path — snake_case, `releases[]` array). */
export function factsFromRow(row: {
  status: string;
  hold_types: string[] | null;
  releases: Array<{ release_type: string; actual_return: string | null }> | null;
}): HoldFacts {
  const releases = row.releases ?? [];
  const released = row.status === 'RELEASED';
  return {
    isActive:        row.status === 'ACTIVE',
    isSaleCar:       !!row.hold_types?.includes('sale_car'),
    isOpenException:  released && releases.some(r => r.release_type === 'EXCEPTION' && !r.actual_return),
    isOpenMechanical: released && releases.some(r => r.release_type === 'MECHANICAL_RELEASE' && !r.actual_return),
    isPreExisting:    released && releases.some(r => r.release_type === 'PRE_EXISTING'),
  };
}

/** Facts from a domain `Hold` (write path — camelCase, single `release`). */
export function factsFromHold(hold: {
  status: string;
  holdTypes: string[];
  release?: { releaseType: string; actualReturn?: string | null } | null;
}): HoldFacts {
  const released = hold.status === 'RELEASED';
  const rt = hold.release?.releaseType;
  return {
    isActive:        hold.status === 'ACTIVE',
    isSaleCar:       hold.holdTypes.includes('sale_car'),
    isOpenException:  released && rt === 'EXCEPTION' && !hold.release?.actualReturn,
    isOpenMechanical: released && rt === 'MECHANICAL_RELEASE' && !hold.release?.actualReturn,
    isPreExisting:    released && rt === 'PRE_EXISTING',
  };
}
