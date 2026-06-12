import type { Hold, HoldType } from '../types';

export const STALE_HOLD_MS = 48 * 60 * 60 * 1000;

export function isStaleHold(hold: Hold, now = Date.now()): boolean {
  return (
    hold.status === 'ACTIVE' &&
    now - new Date(hold.flaggedAt).getTime() > STALE_HOLD_MS
  );
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
