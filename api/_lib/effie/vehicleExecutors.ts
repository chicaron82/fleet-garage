// Effie executors — vehicle domain: read-only lookups keyed to a vehicle (full lookup,
// last-known location, class-code decode). Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeLookup, type HoldFact, type VehicleLookupResult } from '../vehicleSummary.js';
import { correctManitobaPlate } from '../platePrefix.js';
import { normalizePlate, resolveVehicleRow, toVehicleFact, SCHED_TZ, scheduleDateLabel } from '../effieHelpers.js';
import { lookupVehicleClass } from '../vehicleClassCodex.js';

/** Is this plate on the Geotab install watchlist and still pending? Keyed by the
 *  MB-corrected plate, matching how the sheet plates are stored (see migration 095). */
async function isGeotabPending(supabase: SupabaseClient, rawPlate: string): Promise<boolean> {
  const plate = correctManitobaPlate(rawPlate);
  if (!plate) return false;
  const { data } = await supabase
    .from('geotab_watchlist')
    .select('plate')
    .eq('plate', plate)
    .is('installed_at', null)
    .maybeSingle();
  return !!data;
}

/** Run the read-only vehicle lookup as the asking user (RLS-scoped via the JWT client). */
export async function executeLookup(supabase: SupabaseClient, rawPlate: string): Promise<VehicleLookupResult> {
  const match = await resolveVehicleRow(supabase, rawPlate);
  const geotabPending = await isGeotabPending(supabase, rawPlate);
  const withGeotab = (r: VehicleLookupResult): VehicleLookupResult => geotabPending
    ? { ...r, geotabPending: true, summary: `${r.summary} ⚠️ ON THE GEOTAB INSTALL LIST — needs a Geotab unit installed.` }
    : r;
  if (!match) return withGeotab(summarizeLookup(rawPlate, null, []));

  // ACTIVE holds block; RELEASED holds are worth-knowing context (esp. verbal
  // overrides). Embed the release detail so the answer can name who authorized it.
  const { data: holdRows, error: hErr } = await supabase
    .from('holds')
    .select(
      'hold_type, status, damage_description, flagged_at, flagged_by_name, releases(release_method, release_type, override_authorization)',
    )
    .eq('vehicle_id', match.id)
    .in('status', ['ACTIVE', 'RELEASED']);
  if (hErr) throw hErr;

  const holds: HoldFact[] = (holdRows ?? []).map((h) => {
    const rel = Array.isArray(h.releases) ? h.releases[0] : h.releases;
    return {
      holdType: h.hold_type,
      status: h.status,
      damageDescription: h.damage_description ?? '',
      flaggedAt: h.flagged_at,
      flaggedByName: h.flagged_by_name ?? null,
      release: rel
        ? { method: rel.release_method, type: rel.release_type, authorizedBy: rel.override_authorization ?? null }
        : null,
    };
  });

  return withGeotab(summarizeLookup(rawPlate, toVehicleFact(match), holds));
}

/** Read-only: where a vehicle was last SENT, from its trip history (vsa_trips).
 *  Answers "where's LFJ285?" ACROSS DAYS — the Movement Log SCREEN is day-scoped,
 *  but the trip DATA persists here. Trips key off free-text plate/unit (no
 *  vehicle_id), so we match in JS like resolveVehicleRow does — robust to how a
 *  plate was typed. Returns the latest trip plus a short recent history. */
export async function executeLookupVehicleLocation(supabase: SupabaseClient, rawPlate: string): Promise<string> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return JSON.stringify({ found: false, note: 'No plate given.' });

  // Resolve the fleet row (if any) so we can also match on its canonical plate/unit,
  // not just what the operator typed.
  const vehicle = await resolveVehicleRow(supabase, rawPlate);
  const ids = new Set<string>([norm]);
  if (vehicle?.license_plate) ids.add(normalizePlate(vehicle.license_plate));
  if (vehicle?.unit_number) ids.add(normalizePlate(vehicle.unit_number));

  // The table grows slowly (a handful of runs a day); a generous recent window
  // covers many months, and matching in JS sidesteps free-text formatting drift.
  const { data: trips, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, depart_location, arrive_location, depart_time, trip_type, status')
    .order('depart_time', { ascending: false })
    .limit(500);
  if (error) throw error;

  const mine = (trips ?? []).filter(
    (t) => ids.has(normalizePlate(t.vehicle_plate ?? '')) || ids.has(normalizePlate(t.vehicle_unit ?? '')),
  );
  const label = vehicle?.unit_number ?? vehicle?.license_plate ?? rawPlate.trim();
  if (mine.length === 0) {
    return JSON.stringify({
      plate: label,
      found: false,
      tripCount: 0,
      note: 'No trip on record — never logged out, or logged under a different plate.',
    });
  }

  const toEntry = (t: (typeof mine)[number]) => ({
    destination: t.arrive_location ?? t.depart_location ?? 'unknown',
    when: scheduleDateLabel(new Date(t.depart_time).toLocaleDateString('en-CA', { timeZone: SCHED_TZ })),
    tripType: t.trip_type,
    status: t.status,
  });
  return JSON.stringify({
    plate: label,
    found: true,
    tripCount: mine.length,
    lastSent: toEntry(mine[0]),
    recent: mine.slice(0, 5).map(toEntry),
  });
}

/** Read-only: resolve a key-tag class code to make/model (pure codex lookup, no I/O). */
export function executeLookupVehicleClass(input: { code?: string }): string {
  const vc = lookupVehicleClass(input.code);
  if (!vc) {
    return JSON.stringify({
      ok: false,
      code: input.code ?? '',
      reason: 'Unknown class code — ask the user for the make and model.',
    });
  }
  return JSON.stringify({ ok: true, make: vc.make, model: vc.model });
}
