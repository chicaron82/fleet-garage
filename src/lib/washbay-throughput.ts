import { gasSheetCount } from './gas-sheet';

// The closing-log fields needed to turn "cars fuelled" into "cars sent to fleet".
export interface SentToFleetInput {
  fullPages: number;
  lastPageEntries: number;
  carsRemaining: number;
  nonRentablesFuelled: number;
  deferredCompletions: number;
}

// Cars actually sent to fleet on a closing log's day.
//
// The gas sheet counts cars *fuelled*; the rate/throughput system reads that as
// cars *sent*. This corrects the proxy:
//   − carsRemaining        still in the wash queue at close (didn't ship)
//   − nonRentablesFuelled  fuelled but parked: damage-held / new, no plates yet
//   + deferredCompletions  shipped today but fuelled a PRIOR day (plate install)
//
// A car lands in exactly one of those three buckets per day, so there's no
// double-count. Clamped at 0 — the net adjustment can't drive sent-to-fleet
// negative. Mirrors how carsRemaining was already netted at the call sites; the
// per-shift partition consumes this number, it doesn't recompute it.
export function sentToFleet(log: SentToFleetInput): number {
  return sentToFleetFromCount(
    gasSheetCount(log.fullPages, log.lastPageEntries),
    log.carsRemaining,
    log.nonRentablesFuelled,
    log.deferredCompletions,
  );
}

// Same arithmetic keyed off an already-computed gas-sheet count, so the live
// closing-form preview (which works in page-counter units) and the persisted
// rate path share one definition of "sent to fleet".
export function sentToFleetFromCount(
  carsIn: number,
  carsRemaining: number,
  nonRentablesFuelled: number,
  deferredCompletions: number,
): number {
  return Math.max(0, carsIn - carsRemaining - nonRentablesFuelled + deferredCompletions);
}
