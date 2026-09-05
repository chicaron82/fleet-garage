import { SCRIPT_WRITTEN_FIELDS } from './sightings';
import { fieldLabel, isNoiseField } from './vehicleChanges';
import type { VehicleChangeRow } from './vehicleChanges';

/**
 * HIS OWN TRAIL — the same `vehicle_changes` rows FG already keeps, read down the other axis.
 *
 * `sightings.ts` says it plainly: *"`vehicle_changes` has watched him work since 2026-08-19, and
 * every write he makes at a car is an interaction."* FG surfaces that only from the CAR's point of
 * view — open a vehicle, see its history. There has never been a screen that speaks about HIM.
 *
 * ⭐ Zero new data and zero new collection. This is a RECEIPT, not a retrospective: every row is
 * something FG was present for. It deliberately cannot answer "your best Thursday"
 * (reference_fg_data_blind_spots) — only "here is what you actually did, written down at the time."
 */

/**
 * A change row that still knows WHICH car it belongs to.
 *
 * ⚠️ `VehicleChangeRow` deliberately has no `vehicleId`: `useVehicleChanges` filters BY the vehicle,
 * so the column would be the same value on every row it returns. This axis is the opposite — many
 * cars, one actor — so the id has to survive. Its own type rather than a cast, because the cast is
 * what hid the gap in the first draft.
 */
export type TrailChangeRow = VehicleChangeRow & { vehicleId: string };

/** One car he was at, with everything he did to it in the window folded together. */
export interface TrailStop {
  vehicleId: string;
  /** Resolved from vehicles already in context — this file never fetches. */
  plate: string | null;
  unitNumber: string | null;
  /** Newest touch, ISO. The list orders by this. */
  at: string;
  /** How many separate writes he made at this car. */
  touches: number;
  /** FG's own words for what he changed, deduped and ordered — e.g. ["Odometer", "Plate"]. */
  did: string[];
}

export interface VehicleLookup {
  (vehicleId: string): { plate: string | null; unitNumber: string | null } | null;
}

/** Fields the app writes on his behalf. A row of only these means a script ran, not that he stood
 *  at a car — the exact judgement `sightings.ts` already makes, reused rather than re-decided. */
function isHisWork(row: TrailChangeRow): boolean {
  const fields = Object.keys(row.changed ?? {});
  if (fields.length === 0) return false;
  return fields.some(f => !SCRIPT_WRITTEN_FIELDS.has(f) && !isNoiseField(f));
}

/**
 * Fold his rows into one stop per car, newest first.
 *
 * ⚠️ `actor` is compared as a plain string against BOTH his profile id and any agent name that acts
 * as him (`dizee`). Anything else — another user, or the null actor on the 2026-08-19→30 bulk
 * import — is not his and is dropped. A trail that quietly counts an import as work he did would be
 * worse than no trail.
 */
export function buildTrail(
  rows: readonly TrailChangeRow[],
  actors: readonly string[],
  resolve: VehicleLookup,
): TrailStop[] {
  const mine = new Set(actors.filter(Boolean).map(a => a.toLowerCase()));
  const byCar = new Map<string, TrailStop>();

  for (const row of rows) {
    const actor = (row.actor ?? '').toLowerCase();
    if (!actor || !mine.has(actor)) continue;
    if (!isHisWork(row)) continue;
    const id = row.vehicleId;
    if (!id) continue;

    const fields = Object.keys(row.changed ?? {})
      // ⭐ Both filters, and NEITHER list is defined here: `SCRIPT_WRITTEN_FIELDS` already decides
      // what means a human was at the car, and `NOISE` already decides what is bookkeeping. Copying
      // either would be two judgements drifting apart.
      .filter(f => !SCRIPT_WRITTEN_FIELDS.has(f) && !isNoiseField(f))
      .map(fieldLabel);

    const existing = byCar.get(id);
    if (existing) {
      existing.touches += 1;
      if (row.changedAt > existing.at) existing.at = row.changedAt;
      for (const f of fields) if (!existing.did.includes(f)) existing.did.push(f);
      continue;
    }
    const v = resolve(id);
    byCar.set(id, {
      vehicleId: id,
      plate: v?.plate ?? null,
      unitNumber: v?.unitNumber ?? null,
      at: row.changedAt,
      touches: 1,
      did: [...new Set(fields)],
    });
  }

  for (const stop of byCar.values()) stop.did.sort((a, b) => a.localeCompare(b));
  return [...byCar.values()].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/**
 * The line at the top, and the whole reason this surface exists.
 *
 * ⭐ It says CARS, not writes. He does not think in database rows; he thinks in cars he stood at.
 * Two writes to one car is one car. And it addresses him directly — FG has spent its whole life
 * talking about vehicles, holds and lots, and has never once said "you did this".
 */
export function trailHeadline(stops: readonly TrailStop[]): string {
  const n = stops.length;
  if (n === 0) return '';                       // silent when empty; the card renders nothing
  if (n === 1) return "You've been at one car today.";
  return `You've been at ${n} cars today.`;
}

/** "Plate · unit" the way the rest of FG names a car, degrading honestly when it knows neither. */
export function stopName(stop: TrailStop): string {
  const parts = [stop.plate, stop.unitNumber].filter(Boolean) as string[];
  return parts.length ? parts.join(' · ') : 'a car FG has no record of';
}
