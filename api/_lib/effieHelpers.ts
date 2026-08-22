// Shared helpers for Effie's tools (api/fg-chat): plate normalization + fleet-row
// resolution, and the Winnipeg date formatting the schedule/trip tools use. Lifted out
// of fg-chat verbatim so each tool module imports them instead of living in a god-file.
import type { SupabaseClient } from '@supabase/supabase-js';
import { correctManitobaPlate } from './platePrefix.js';
import type { VehicleFact } from './vehicleSummary.js';

/** Canonical plate form for matching — mirrors src/lib/vehicleByPlate.ts normalizePlate. */
export function normalizePlate(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

/** The minimal vehicle row the tools work from. */
export interface VehicleRow {
  id: string;
  license_plate: string;
  unit_number: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
}

/** Resolve a plate/unit to its fleet row (RLS-scoped), matched in JS like the app does. */
export async function resolveVehicleRow(supabase: SupabaseClient, rawPlate: string): Promise<VehicleRow | null> {
  const norm = normalizePlate(rawPlate);
  if (!norm) return null;
  // Also try the MB-prefix-corrected form, so a handwriting/keytag misread (KMR250 →
  // KUR250) still resolves. Only snaps a not-in-fleet prefix to a known one, so it
  // can add a match but never breaks the exact one (checked first).
  const corrected = correctManitobaPlate(norm);
  // The fleet is small and plates aren't stored normalized, so match in JS the same
  // way the app does (allVehicles.find). RLS limits the rows to this user's reach.
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, license_plate, unit_number, make, model, year, color')
    .is('archived_at', null);
  if (error) throw error;
  return (
    (vehicles ?? []).find((v) => {
      const plate = normalizePlate(v.license_plate ?? '');
      return (
        plate === norm ||
        plate === corrected ||
        (v.unit_number ? normalizePlate(v.unit_number) === norm : false)
      );
    }) ?? null
  );
}

export function toVehicleFact(row: VehicleRow): VehicleFact {
  return {
    plate: row.license_plate,
    unitNumber: row.unit_number ?? null,
    year: row.year ?? null,
    make: row.make ?? null,
    model: row.model ?? null,
    color: row.color ?? null,
  };
}

// ── Winnipeg dates ───────────────────────────────────────────────────────────────
export const SCHED_TZ = 'America/Winnipeg'; // FG is a single-region YWG pilot

export function todayInWinnipeg(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: SCHED_TZ }); // YYYY-MM-DD
}

export function scheduleDateLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** "Saturday, June 27, 2026" — weekday + full date so the model can anchor bare dates. */
export function todayLabelWinnipeg(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function addDaysISO(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
