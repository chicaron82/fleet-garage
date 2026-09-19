// Shared helpers for Effie's tools (api/fg-chat): plate normalization + fleet-row
// resolution, and the Winnipeg date formatting the schedule/trip tools use. Lifted out
// of fg-chat verbatim so each tool module imports them instead of living in a god-file.
import type { SupabaseClient } from '@supabase/supabase-js';
import { plateCandidates } from './platePrefix.js';
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
  // The fleet is small and plates aren't stored normalized, so match in JS the same
  // way the app does (allVehicles.find). RLS limits the rows to this user's reach.
  const { data: vehicles, error } = await supabase
    .from('vehicles')
    .select('id, license_plate, unit_number, make, model, year, color')
    .is('archived_at', null);
  if (error) throw error;
  const rows = vehicles ?? [];
  // ⚠️⚠️ THIS COMMENT USED TO SAY THE EXACT PLATE WAS "checked first". IT WAS NOT. The match was one
  // `.find()` over `plate === norm || plate === corrected || unit === norm`, so it returned whichever
  // row came FIRST IN DATABASE ORDER — if a raw plate and its correction were both real cars, Effie
  // could hand back the wrong one, and a unit match on an earlier row could beat a plate match on a
  // later one. Found 2026-09-19 while fixing the 0GE511 → KGE511 lookup
  // (`docs/ticket-plate-correction-resolves-first.md`).
  // ⭐ Now three passes, in strength order: the plate as given, then its MB correction, then the unit.
  for (const candidate of plateCandidates(norm)) {
    const hit = rows.find((v) => normalizePlate(v.license_plate ?? '') === candidate);
    if (hit) return hit;
  }
  return rows.find((v) => (v.unit_number ? normalizePlate(v.unit_number) === norm : false)) ?? null;
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
