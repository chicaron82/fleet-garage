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
}

/**
 * The active holds on one vehicle, shaped for the scan card. Newest first, because the thing he
 * just flagged is the thing he's most likely standing there about.
 *
 * ⚠️ ACTIVE ONLY. A repaired or returned hold is history, and history belongs on the vehicle
 * record — putting it in the scan card would bury the one line he actually needs under a log.
 */
export function scanHoldLines(holds: readonly Hold[], vehicleId: string): ScanHoldLine[] {
  return holds
    .filter(h => h.vehicleId === vehicleId && h.status === 'ACTIVE')
    .map(h => ({
      id: h.id,
      typeLabel: h.holdTypes.map(holdTypeLabel).join(' + '),
      detail: (h.damageDescription ?? '').trim(),
      flaggedAt: h.flaggedAt,
      // An EXCEPTION release with no actualReturn means the car went out carrying this. That's the
      // case he most needs named at the tag — it's the [[old-damage amnesia]] the whole app exists
      // to prevent: damage approved once, then circulating unrepaired and un-re-flagged.
      onException: h.release?.releaseType === 'EXCEPTION' && !h.release?.actualReturn,
    }))
    .sort((a, b) => (a.flaggedAt < b.flaggedAt ? 1 : -1));
}

/** Short date for the card — "Aug 12". Compact enough to sit inline beside the damage text. */
export function flaggedOnLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
}
