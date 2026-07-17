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
 *   on-exception       — a hold released on an open EXCEPTION or MECHANICAL_RELEASE
 *   pre-existing       — a hold released as PRE_EXISTING (damage accepted as-is)
 *   clear              — none of the above
 *
 * On-exception beats pre-existing: a vehicle still OUT on an override (often a
 * verbal/unverified one) or out for mechanical work is an active concern that
 * belongs in Exception Returns for return-comparison — it outranks accepted
 * pre-existing damage, which is a stable "renting as-is" state. Only an *open*
 * exception counts; one that's already returned falls through to pre-existing.
 * Auction still beats both: a sale car going to auction as-is shows its auction
 * status. Pre-existing is a release decision, never a hold type — it's detected
 * from the release record.
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
  if (facts.some(f => f.isOpenException || f.isOpenMechanical)) return 'on-exception';
  if (facts.some(f => f.isPreExisting))              return 'pre-existing';
  return 'clear';
}

/**
 * True for the "out on an override — scrutinize it on return" statuses: OUT_ON_EXCEPTION (a hold
 * released on an open exception/mechanical, still circulating) or AUCTION_SHORT_TERM (a sale car
 * out to auction as-is). The single predicate behind Exception Returns, the Airport Flip re-hold,
 * AND the scan-router status pill — so those surfaces can never disagree on what "on exception"
 * means (they did: the scanner read a released-hold car as "✅ Clear" while it was OUT_ON_EXCEPTION).
 */
export function isOnExceptionStatus(status: VehicleStatus): boolean {
  return status === 'OUT_ON_EXCEPTION' || status === 'AUCTION_SHORT_TERM';
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

/**
 * The linked prior hold whose OPEN exception a repair should auto-close, or null.
 *
 * When an exception-released hold is re-flagged and repaired, the re-hold carries
 * `linkedHoldId` pointing at the original release (set by the re-hold flow). Once
 * the underlying issue is repaired, the exception that was only covering for that
 * same issue has nothing left to cover — so this finds the linked hold still
 * holding an OPEN exception (the thing keeping the vehicle `on-exception`) for the
 * caller to close.
 *
 * The link is the identity — an unlinked hold is never matched, and we never
 * fuzzy-match on description/type. Only an open EXCEPTION qualifies: an already
 * returned exception (`actualReturn` set), a PRE_EXISTING/MECHANICAL release, or a
 * non-RELEASED hold all return null.
 */
export function findLinkedOpenException<
  T extends {
    id: string;
    status: string;
    release?: { releaseType: string; actualReturn?: string | null } | null;
  },
>(repairedHold: { linkedHoldId?: string | null }, holds: T[]): T | null {
  if (!repairedHold.linkedHoldId) return null;
  const linked = holds.find(h => h.id === repairedHold.linkedHoldId);
  if (!linked) return null;
  const r = linked.release;
  const isOpenException =
    linked.status === 'RELEASED' && r?.releaseType === 'EXCEPTION' && !r.actualReturn;
  return isOpenException ? linked : null;
}

/**
 * Derives the status AND returns the holds in the winning bucket, in the same
 * cascade priority as `deriveHoldStatus`. Callers get status + group from one
 * derivation — no need to re-implement the bucket predicates locally.
 *
 * `group` is empty when status is 'clear'. `winner` selection (earliest by
 * created_at or equivalent) is left to the caller since this module is
 * agnostic about the T shape.
 */
export function deriveWithWinner<T>(
  pairs: Array<{ facts: HoldFacts; hold: T }>
): { status: HoldDerivedStatus; group: T[] } {
  const status = deriveHoldStatus(pairs.map(p => p.facts));
  if (status === 'clear') return { status, group: [] };
  const group = pairs
    .filter(({ facts: f }) => {
      switch (status) {
        case 'held':               return f.isActive && !f.isSaleCar;
        case 'sale-car':           return f.isActive && f.isSaleCar;
        case 'auction-short-term': return f.isOpenException && f.isSaleCar;
        case 'pre-existing':       return f.isPreExisting;
        case 'on-exception':       return f.isOpenException || f.isOpenMechanical;
      }
    })
    .map(p => p.hold);
  return { status, group };
}
