import type { Hold } from '../types';

export const STALE_HOLD_MS = 48 * 60 * 60 * 1000;

export function isStaleHold(hold: Hold, now = Date.now()): boolean {
  return (
    hold.status === 'ACTIVE' &&
    now - new Date(hold.flaggedAt).getTime() > STALE_HOLD_MS
  );
}
