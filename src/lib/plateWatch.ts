import { normalizePlate } from './fleetAudit';

// A plate to stop on, including one FG has never seen.
//
// Aaron, 2026-08-26, off a whiteboard in the washbay ("OUT 86 / IN 85 / DFDA712 HOLD PLS. THX"):
// *"can I add a license plate to watch for? it doesn't exist in FG. so if I scanned it, it would
// tell me to hold it."*
//
// ⭐ THE UNSEEN PLATE IS THE POINT, not an edge case. A car FG knows already has somewhere for a
// note to live — flag a hold on it. A car FG has never seen has nowhere at all, and an unknown car
// is the EASIEST one to clean, stage and send straight back out, because nothing on any screen
// objects. So the moment a watch matters most is the moment FG otherwise has the least to say.
// That is also why this is keyed on the PLATE and never on a vehicle id.

export interface PlateWatch {
  id: string;
  plate: string;
  reason: string;
  createdAt: string;
  resolvedAt: string | null;
}

/**
 * The watch a scanned plate hits, or null.
 *
 * ⚠️ MATCHES ON `normalizePlate` ONLY — upper-cased, alphanumerics kept. It deliberately does NOT
 * run the read through `correctManitobaPlate`. That corrector is safe where it is used because it
 * is gated on a known MB prefix AND the AAA111 shape (so it leaves `DFDA712` untouched), but the
 * principle matters more than today's behaviour: **a watch must never silently rewrite a plate into
 * a different car's.** The cost of a missed watch is a car that should have been held going out
 * once. The cost of a wrongly-corrected match is telling him to hold the WRONG car, on a surface
 * whose entire job is to be believed.
 *
 * Resolved watches never match — clearing is an event, and a cleared watch has done its job.
 */
export function watchFor(
  plate: string | null | undefined,
  watches: readonly PlateWatch[],
): PlateWatch | null {
  const key = normalizePlate(plate);
  if (!key) return null;
  return watches.find(w => !w.resolvedAt && normalizePlate(w.plate) === key) ?? null;
}

/** The live watches, newest first — what the board shows. */
export function liveWatches(watches: readonly PlateWatch[]): PlateWatch[] {
  return watches
    .filter(w => !w.resolvedAt)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0));
}

/**
 * Clean a typed plate into a storable one, or '' when it isn't one.
 *
 * ⚠️ No length or shape rule on purpose. FG sees Manitoba (AAA111), Ontario (AAAA999) and whatever
 * else an out-of-province conversion drags in, and a watch is the one place a stranger plate is the
 * expected input. Rejecting an unfamiliar shape here would refuse exactly the cars this exists for.
 */
export function normalizeWatchPlate(raw: string | null | undefined): string {
  return normalizePlate(raw);
}
