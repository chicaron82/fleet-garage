// Odometer readings written from OUTSIDE the app, counted as sightings (docs/ticket-odo-counts-as-seen.md).
//
// ⭐ Aaron, 2026-10-18, after a weekend of gas-card odometers left his Top 10 frozen since Friday: *"a change to
// the odo especially ones you write to should also count as seen."* A gas card is the car at the pump: somebody
// had it in hand and read its dash. That is a sighting by any honest reading.
//
// ⚠️ WHY ONLY OUTSIDE WRITES. Inside the app, his first change after a typed lookup already commits the lookup's
// held sighting (`useVehicleSightings`): *"looking up doesn't count as seen until i make a change to a vehicle"*.
// So his own odometer change is ALREADY one `vehicle_sightings` row; counting the change too would count that one
// visit twice (2,522 of his 2,647 odometer changes sit within 15 minutes of a sighting of the same car). A write
// from outside (my gas-card entries) never touches `vehicle_sightings`, which is exactly the gap he saw.
//
// "Outside" = the change's `actor` is set and is NOT an app user's uuid. Migration 132 records a JWT `sub` (a uuid)
// for an app session and the `app.actor` name for anything else; on 2026-10-18 every non-uuid odometer actor was
// mine (`dizee`, and one 09-05 pump-card batch signed by name). A NULL actor is left out: it can be an app write
// from before migration 132, which would double count, so an unsigned row of mine counts only once relabelled.

const APP_USER = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isOutsideWrite(actor: string | null | undefined): boolean {
  const a = (actor ?? '').trim();
  return a !== '' && !APP_USER.test(a);
}

export interface OdoChangeRow {
  vehicle_id: string | null;
  changed_at: string | null;
  actor: string | null;
}

/** The odometer changes that count as sightings, in `vehicle_sightings`' own shape. */
export function outsideOdoSightings(rows: readonly OdoChangeRow[]): { vehicle_id: string; seen_at: string }[] {
  const out: { vehicle_id: string; seen_at: string }[] = [];
  for (const r of rows) {
    if (r.vehicle_id && r.changed_at && isOutsideWrite(r.actor)) out.push({ vehicle_id: r.vehicle_id, seen_at: r.changed_at });
  }
  return out;
}
