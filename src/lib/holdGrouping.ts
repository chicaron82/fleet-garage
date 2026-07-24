// ── Hold History grouping ─────────────────────────────────────────────────────
// Which bucket a hold belongs in on the vehicle detail screen. Found live on the lot
// (2026-07-23, unit 5423777): a RETURNED geotab hold sat beside an ACTIVE windshield hold in
// identical chrome, so a finished hold read as though the car still needed a geotab.
//
// The grouping key is "is this still acting on the car?" — which IS derivable — and deliberately
// NOT "done vs not done", which isn't. `RETURNED` does not mean repaired: per `makeMarkReturned`
// it means an exception-released vehicle came back and a re-evaluation is owed. Only `REPAIRED`
// means fixed. So the labels stay untouched; only the grouping and emphasis change.
//
// This is the record-level twin of `unresolvedHoldTypes` ("a resolved type stays in holdTypes but
// shouldn't read as active") — same principle, applied to the whole hold instead of one pill.
import type { Hold, HoldType, Release, VehicleStatus } from '../types';

export type HoldGroup = 'open' | 're-eval' | 'closed';

/** Vehicle statuses meaning "out on an override, or back but not yet re-evaluated". */
const AWAITING_REEVAL: VehicleStatus[] = ['OUT_ON_EXCEPTION', 'RETURNED'];

/** The parts of a hold that decide its bucket — narrow so callers/tests need no full fixture. */
export type GroupableHold = Pick<Hold, 'status'> & {
  holdTypes?: HoldType[];
  release?: Pick<Release, 'releaseType' | 'actualReturn'>;
};

/**
 * Bucket one hold against the vehicle's current derived status.
 *
 * `re-eval` mirrors ExceptionReturnSection's worklist, which lists an item only while the hold is
 * RELEASED/RETURNED *and* the vehicle is still OUT_ON_EXCEPTION/RETURNED. Once the vehicle derives
 * to anything else — HELD from a fresh flag, CLEAR, PRE_EXISTING — it has dropped out of that
 * worklist, which is exactly the signal that the re-evaluation already happened. That is why a
 * returned hold on an otherwise-moved-on vehicle is genuinely past and may recede.
 */
export function holdGroup(hold: GroupableHold, vehicleStatus: VehicleStatus): HoldGroup {
  // A sale/auction flag is a CLASSIFICATION, never work anyone can do — deriveHoldStatus makes the
  // same carve-out (`isActive && !isSaleCar → 'held'`) and gives sale-car its own branch. Nothing
  // is lost by receding: the VEHICLE badge still reads Sale Car / Auction.
  if (hold.holdTypes?.includes('sale_car')) return 'closed';
  // A PRE_EXISTING release is a settled decision — damage accepted, vehicle stays in circulation.
  // It must be tested BEFORE the actualReturn rule below, because such a release never gets an
  // actualReturn (the car never comes back — it never left), which made a settled acceptance
  // indistinguishable from a car still out on an exception.
  if (hold.release?.releaseType === 'PRE_EXISTING') return 'closed';

  if (hold.status === 'ACTIVE') return 'open';                       // still flagging the car
  // Released on a real override with no return recorded — the car is out and the issue is unresolved.
  if (hold.status === 'RELEASED' && !hold.release?.actualReturn) return 'open';
  if (hold.status === 'RETURNED' && AWAITING_REEVAL.includes(vehicleStatus)) return 're-eval';
  return 'closed';   // REPAIRED, VOIDED, returned-and-reviewed, released-and-back
}

/**
 * A sale/auction flag that "clear logged in error" can still undo.
 *
 * Any UNRESOLVED state qualifies. The gate used to be ACTIVE-or-still-out-on-EXCEPTION, so the
 * affordance vanished the moment a short-term rental came back (`RETURNED`) — which is exactly
 * when someone notices the flag was wrong, so the mistake stuck to the record permanently (unit
 * 5424395, 2026-07-23). Sale cars legitimately go back out on short term when fleet is tight, so
 * a return is normal traffic, not a resolution. VOIDED is already cleared and REPAIRED is a real
 * resolution — neither needs the button.
 */
export function isClearableSaleFlag(hold: Pick<Hold, 'status' | 'holdTypes'>): boolean {
  return hold.holdTypes.includes('sale_car') && hold.status !== 'VOIDED' && hold.status !== 'REPAIRED';
}

/** True when the hold stays on the record but no longer acts on the vehicle. */
export function isClosedHold(hold: GroupableHold, vehicleStatus: VehicleStatus): boolean {
  return holdGroup(hold, vehicleStatus) === 'closed';
}

/**
 * Split a vehicle's holds into what still needs attention and what is history, preserving the
 * caller's ordering within each bucket. `open` keeps re-eval holds alongside active ones — a hold
 * still owed a re-evaluation is unfinished business, not past.
 */
export function groupHolds<T extends GroupableHold>(
  holds: T[],
  vehicleStatus: VehicleStatus,
): { open: T[]; closed: T[] } {
  const open: T[] = [];
  const closed: T[] = [];
  for (const hold of holds) {
    (isClosedHold(hold, vehicleStatus) ? closed : open).push(hold);
  }
  return { open, closed };
}
