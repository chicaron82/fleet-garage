// A re-held hold and the earlier releases it stands for — one damage, shown once.
//
// ⭐ WHY (Aaron, 2026-10-09, on LZM532): *"When there's a hold. And gets released on exception, then
// reheld for the same damage.. it shows multiple. Since it's the same. Would it be better to have it
// shown once. So when marking it as … done, would only need to tap one. In record it would still
// show as held, released, held again."*
//
// The repair picker listed every unresolved hold flat, so one hail damage appeared as two rows
// (ACTIVE Sep 30, RELEASED Aug 28). Ticking both wrote TWO repair rows for one repair and left the
// August release with no return date; ticking only the active one wrote one repair and closed the
// older hold as returned. Same event, two records, decided by which boxes got ticked.
//
// ⚠️ THE LINK IS THE IDENTITY (his ruling, same day: *"Agree"*). Only `linkedHoldId`, written by the
// re-hold flow, joins two holds. Never description, type or zones — two hail holds can be two storms,
// and a same-damage hold re-added with "+ Add hold" stays its own row.
//
// ⚠️ CHAINS ARE REAL: 10 of the 70 linked holds in the data on the day this was written link to a
// hold that is itself linked (held, released, re-held, released, re-held). So this walks the whole
// chain; closing only the first link would leave the oldest exception open behind a repaired car.

interface LinkHold {
  id: string;
  status: string;
  linkedHoldId?: string | null;
  release?: { releaseType: string; actualReturn?: string | null } | null;
}

const isOpenException = (h: LinkHold): boolean =>
  h.status === 'RELEASED' && h.release?.releaseType === 'EXCEPTION' && !h.release.actualReturn;

/**
 * Every earlier hold in `hold`'s link chain that still holds an OPEN exception, nearest first.
 *
 * Walks THROUGH a link that is already closed (returned, repaired, pre-existing) to reach an older
 * one that is not, and stops on a missing hold or a loop.
 */
export function linkedOpenExceptionChain<T extends LinkHold>(
  hold: { id: string; linkedHoldId?: string | null },
  holds: readonly T[],
): T[] {
  const chain: T[] = [];
  const seen = new Set<string>([hold.id]);
  let next = hold.linkedHoldId ?? null;
  while (next && !seen.has(next)) {
    seen.add(next);
    const linked = holds.find(h => h.id === next);
    if (!linked) break;
    if (isOpenException(linked)) chain.push(linked);
    next = linked.linkedHoldId ?? null;
  }
  return chain;
}

export interface RepairRow<T> {
  /** The hold the operator resolves. */
  hold: T;
  /** Earlier open exceptions for the same damage, closed with it. Nearest first. */
  earlier: T[];
}

/**
 * The repair picker's rows: one per linked chain.
 *
 * A repairable hold is folded under a LATER repairable hold whose chain reaches it — exactly the
 * holds `linkedOpenExceptionChain` hands the repair to close, so the picker never hides a hold the
 * tap will not resolve. "Later" is by `flaggedAt`, which also means a loop in bad data can never
 * fold every row away.
 */
export function collapseRepairable<T extends LinkHold & { flaggedAt: string }>(
  repairable: readonly T[],
  holds: readonly T[],
): RepairRow<T>[] {
  const earlierOf = new Map<string, T[]>();
  const folded = new Set<string>();
  for (const h of repairable) {
    const earlier = linkedOpenExceptionChain(h, holds).filter(e => e.flaggedAt < h.flaggedAt);
    earlierOf.set(h.id, earlier);
    for (const e of earlier) folded.add(e.id);
  }
  return repairable
    .filter(h => !folded.has(h.id))
    .map(h => ({ hold: h, earlier: earlierOf.get(h.id) ?? [] }));
}
