import { plateCandidates } from '../../api/_lib/platePrefix';
import { GEOTAB_HOLD_DESC } from './hold-presets';
import type { Hold, Vehicle } from '../types';

// The 📡 Geotab installs list: every plate STILL PENDING on the watchlist, with its car and its open
// geotab exception when FG has them.
//
// ⭐ Aaron, 2026-09-25: *"may i ask why FG only has 11 that need a geotab installed but the list has 14?"*
// This list used to be built from open geotab HOLDS on cars out on exception, while everything else
// (the scanner badge, Effie, Airport Flip, the archive shield) reads `geotab_watchlist`. Two stores,
// one question. When that morning's sheet reconcile wrote the watchlist, the list kept showing a car
// marked installed (LJF693) and missed four still pending (LJF708, LUR532, LZM531, and LFJ339, which
// never had a hold). Now the watchlist decides who is on the list; a hold only adds detail.
// docs/September/ticket-geotab-lens-reads-watchlist.md

export interface GeotabLensItem {
  plate: string;
  /** Absent when no live vehicle carries this plate. The plate still needs its unit. */
  vehicle?: Vehicle;
  /** The open geotab exception, when the car was let out on one. Absent is normal (LFJ339). */
  hold?: Hold;
}

export function geotabLens(
  pending: ReadonlySet<string>,
  vehicles: readonly Vehicle[],
  holdsFor: (vehicleId: string) => readonly Hold[],
): GeotabLensItem[] {
  const live = vehicles.filter(v => !v.archivedAt);
  return [...pending].sort().map(plate => {
    // The watchlist stores the MB-corrected plate; a record may hold the raw one. Either matches.
    const vehicle = live.find(v => plateCandidates(v.licensePlate).includes(plate));
    const hold = vehicle
      ? holdsFor(vehicle.id).find(h => h.damageDescription === GEOTAB_HOLD_DESC && h.status === 'RELEASED')
      : undefined;
    return { plate, ...(vehicle ? { vehicle } : {}), ...(hold ? { hold } : {}) };
  });
}
