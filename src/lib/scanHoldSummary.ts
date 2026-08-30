// What's actually WRONG with the car you just scanned — the detail the scan card was throwing away.
//
// Aaron, 2026-08-16, standing at a held car with the tag in his hand: *"could it show and/or tell me
// what's up with the vehicle instead of having to open it to view the details. scan, on exception.
// oh windshield chip. verify it is there or has been fixed."*
//
// The overlay already had every active hold in scope — it counted them into "🔧 On hold (2)" and
// dropped `holdTypes` and `damageDescription` on the floor. So the card told him *something is
// wrong* and then made him navigate to find out what: the doorway problem in miniature, and the one
// remaining gap in a card that already surfaces key count, EV kit, geotab and backfill results.
import { holdTypeLabel } from './holdTypeLabels';
import type { Hold } from '../types';

export interface ScanHoldLine {
  id: string;
  /** "Damage", or "Damage + Detail" when a hold carries several types. */
  typeLabel: string;
  /** The damage description as flagged — the "windshield chip" part. '' when none was written. */
  detail: string;
  /** ISO of when it was flagged. Age matters: a chip flagged in May that's still open reads
   *  differently from one flagged yesterday. */
  flaggedAt: string;
  /** Released as an EXCEPTION and not yet returned — i.e. the car is out WITH this damage. */
  onException: boolean;
  /** Panels this damage sits on. Empty on older holds and on types with no place on the car
   *  (a "Geotab not installed" has no panel). `consolidateDamage` keys on these. */
  zones: readonly string[];
}

/**
 * The LIVE holds on one vehicle, shaped for the scan card. Newest first, because the thing he just
 * flagged is the thing he's most likely standing there about.
 *
 * ⚠️ "Live" means ACTIVE **or RELEASED**, and getting this wrong made the feature miss its own
 * headline case. Aaron's ask opened with *"its an out on exception car"* — and an out-on-exception
 * car's hold is **RELEASED**, not ACTIVE: releasing it is what let the car go out. Filtering to
 * ACTIVE alone caught **9 holds out of 422** fleet-wide (199 are RELEASED) and showed nothing on
 * exactly the cars he most needs told about (found live 2026-08-17, 561PIC — a hail car reading
 * "⚠️ On exception" with no reason beside it).
 *
 * A RELEASED hold is not history — **the car is out there carrying that damage right now.** That's
 * [[old-damage amnesia]], the thing FG exists to prevent.
 *
 * Still excluded, and deliberately: REPAIRED (fixed), RETURNED (came back, closed) and VOIDED
 * (logged in error). Those are history and belong on the record — in the scan card they'd bury the
 * one line he needs under a log.
 */
const LIVE: readonly Hold['status'][] = ['ACTIVE', 'RELEASED'];

export function scanHoldLines(holds: readonly Hold[], vehicleId: string): ScanHoldLine[] {
  return holds
    .filter(h => h.vehicleId === vehicleId && LIVE.includes(h.status))
    .map(h => ({
      id: h.id,
      typeLabel: h.holdTypes.map(holdTypeLabel).join(' + '),
      detail: (h.damageDescription ?? '').trim(),
      flaggedAt: h.flaggedAt,
      // An EXCEPTION release with no actualReturn means the car went out carrying this. That's the
      // case he most needs named at the tag — it's the [[old-damage amnesia]] the whole app exists
      // to prevent: damage approved once, then circulating unrepaired and un-re-flagged.
      onException: h.release?.releaseType === 'EXCEPTION' && !h.release?.actualReturn,
      zones: h.damageZones ?? [],
    }))
    .sort((a, b) => (a.flaggedAt < b.flaggedAt ? 1 : -1));
}

/** Short date for the card — "Aug 12". Compact enough to sit inline beside the damage text. */
export function flaggedOnLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
