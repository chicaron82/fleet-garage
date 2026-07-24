// Effie executors — overflow domain: read the overflow manifest (what's sent where) and draft a
// batch of overflow sends. OVERFLOW_DESTINATIONS is imported by exactly these two, so keeping them
// together keeps that import local. Split from effieExecutors.ts (2026-07-24, pure move).
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlate, resolveVehicleRow } from '../effieHelpers.js';
import { shiftBusinessDate } from '../shiftDay.js';
import {
  buildOverflowProposal,
  OVERFLOW_DESTINATIONS,
  type OverflowDestination,
  type OverflowLogProposal,
  type OverflowVehicle,
} from '../overflowProposal.js';

/** Read-only: the overflow manifest — which vehicles are at which overflow spot,
 *  grouped, for the operator to copy into a reply. scope 'current' = latest send per
 *  vehicle across days (where everything is NOW — the "where are these vehicles?"
 *  email); scope 'shift' = only what was sent this shift-day (the end-of-shift report).
 *  Both dedup to the latest send per vehicle, so a moved car shows its newest spot. */
export async function executeLookupSent(supabase: SupabaseClient, input: { scope?: string }): Promise<string> {
  const scope = input.scope === 'shift' ? 'shift' : 'current';
  const { data, error } = await supabase
    .from('vsa_trips')
    .select('vehicle_plate, vehicle_unit, arrive_location, depart_time')
    .in('arrive_location', [...OVERFLOW_DESTINATIONS])
    .order('depart_time', { ascending: false })
    .limit(1000);
  if (error) throw error;

  let rows = data ?? [];
  if (scope === 'shift') {
    const today = shiftBusinessDate(new Date());
    rows = rows.filter((r) => r.depart_time && shiftBusinessDate(new Date(r.depart_time)) === today);
  }
  // Dedup to the latest send per vehicle (rows are newest-first). A returned/re-sent
  // car reflects its newest spot; there's no return-logging, so this is "last sent".
  const seen = new Set<string>();
  const byDest = new Map<string, string[]>();
  for (const r of rows) {
    const label = r.vehicle_unit || r.vehicle_plate || 'Unknown';
    const key = label.toUpperCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const dest = r.arrive_location ?? 'Unknown';
    (byDest.get(dest) ?? byDest.set(dest, []).get(dest)!).push(label);
  }
  const groups = [...byDest.entries()].map(([destination, vehicles]) => ({
    destination,
    count: vehicles.length,
    vehicles,
  }));
  return JSON.stringify({ scope, total: seen.size, groups });
}

/**
 * Draft a batch of overflow sends — resolve each plate to a fleet row (so the trip
 * logs the canonical plate/unit) and build a confirm proposal. NEVER writes: the
 * client logs one completed one-way trip per vehicle only on the tap. Unresolved
 * plates are kept and flagged so the operator sees them before confirming.
 */
export async function executeProposeOverflowLog(
  supabase: SupabaseClient,
  input: { plates?: string[]; destination?: string },
): Promise<{ toolResult: string; proposal: OverflowLogProposal | null }> {
  const destination = (input.destination ?? '') as OverflowDestination;
  const plates = (input.plates ?? []).map((p) => (p ?? '').trim()).filter(Boolean);
  if (!OVERFLOW_DESTINATIONS.includes(destination) || plates.length === 0) {
    return {
      proposal: null,
      toolResult: JSON.stringify({
        ok: false,
        reason: 'Need at least one plate and a destination of AV Flight, FastAir, or Airport.',
      }),
    };
  }
  const vehicles: OverflowVehicle[] = [];
  for (const raw of plates) {
    const row = await resolveVehicleRow(supabase, raw);
    if (row) {
      vehicles.push({
        plate: row.license_plate,
        unit: row.unit_number ?? null,
        label: row.unit_number ? `Unit ${row.unit_number}` : row.license_plate,
        unresolved: false,
      });
    } else {
      vehicles.push({ plate: normalizePlate(raw), unit: null, label: raw.trim(), unresolved: true });
    }
  }
  const proposal = buildOverflowProposal(destination, vehicles);
  return {
    proposal,
    toolResult: JSON.stringify({
      ok: true,
      drafted: `${vehicles.length} vehicle(s) → ${destination}`,
      unresolved: vehicles.filter((v) => v.unresolved).map((v) => v.label),
      awaiting: 'user confirmation — a confirm card is shown; do NOT say it is logged, just that it is drafted to log on their tap',
    }),
  };
}
