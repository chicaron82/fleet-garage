// What an EV-assets exception is about NOW, not what it was about when it was released.
//
// Aaron, 2026-10-13, at LJF689 (unit 5515358): *"This was on exception for missing both. But it was
// updated previously so it's just missing the cable. So the missing both has is stale."* The hold
// text is the canned "Both EV assets missing…" written on Jul 20; a washbay check on Sep 18 found the
// adapter. The scan card printed July's sentence in amber above a ticked Adapter chip.
//
// ⭐ His ruling, both halves (*"Both then ticket"*):
//   1. One asset back → the exception stays open (something is still missing) and the card says
//      which one, from the vehicle's canonical kit record. The hold's own text is NOT rewritten: it is
//      what the manager approved, and a release is a record of a decision.
//   2. Both back → the exception closes itself. See `evExceptionHoldsToClose` and context/evAutoClose.
//
// ⚠️ Only a known `false` is missing and only a known `true` is present. `null` is "never assessed"
// (see ScanEvAssets), so null + present is NOT "both back" and must never close anything.
import { linkedOpenExceptionChain } from './repairChains';
import type { Hold, Vehicle } from '../types';

type Kit = Pick<Vehicle, 'hasMobileCable' | 'hasJ1772Adapter' | 'evLastUpdatedAt'>;

const NAMES = { cable: 'charge cable', adapter: 'adapter' } as const;

export const isEvAssetsHold = (h: Pick<Hold, 'holdTypes'>): boolean =>
  (h.holdTypes ?? []).includes('missing_accessories');

/** Both known present — the only state that ends an EV-assets exception. */
export const bothEvAssetsPresent = (k: Pick<Kit, 'hasMobileCable' | 'hasJ1772Adapter'>): boolean =>
  k.hasMobileCable === true && k.hasJ1772Adapter === true;

const shortDay = (iso: string | null | undefined): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' });
};

/**
 * One clause for under the exception's own text, saying where the kit stands at the latest check.
 * '' when there is nothing to add: the kit still matches "both missing", or nothing was ever checked.
 *
 *   adapter present, cable missing → "Now: adapter found Sep 18 · still missing: charge cable"
 *   both present (close failed)    → "Now: both found Oct 13 · mark it done"
 */
export function evExceptionNowClause(kit: Kit): string {
  const on = shortDay(kit.evLastUpdatedAt);
  const when = on ? ` ${on}` : '';
  if (bothEvAssetsPresent(kit)) return `Now: both found${when} · mark it done`;
  const found = (['cable', 'adapter'] as const).filter(k =>
    (k === 'cable' ? kit.hasMobileCable : kit.hasJ1772Adapter) === true);
  const missing = (['cable', 'adapter'] as const).filter(k =>
    (k === 'cable' ? kit.hasMobileCable : kit.hasJ1772Adapter) === false);
  if (found.length === 0) return '';
  const parts = [`Now: ${found.map(k => NAMES[k]).join(' and ')} found${when}`];
  if (missing.length > 0) parts.push(`still missing: ${missing.map(k => NAMES[k]).join(' and ')}`);
  return parts.join(' · ');
}

const isLive = (h: Hold): boolean =>
  h.status === 'ACTIVE' || (h.status === 'RELEASED' && !h.release?.actualReturn);

/**
 * The EV-assets holds to close once a check finds both assets on `vehicleId`.
 *
 * Returns only the HEADS of link chains: repairing a re-hold already closes the earlier exceptions it
 * links back to (`finalizeRepairedHold` → `linkedOpenExceptionChain`), so closing every hold in a
 * chain would write a repair row per cycle for one recovery — the duplicate his chain rule exists to
 * prevent. Unlinked EV holds on the same car are separate records and each gets closed.
 */
export function evExceptionHoldsToClose(holds: readonly Hold[], vehicleId: string): Hold[] {
  const live = holds.filter(h => h.vehicleId === vehicleId && isEvAssetsHold(h) && isLive(h));
  const covered = new Set(live.flatMap(h => linkedOpenExceptionChain(h, holds).map(c => c.id)));
  return live.filter(h => !covered.has(h.id));
}
