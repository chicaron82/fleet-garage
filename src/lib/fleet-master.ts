import { supabase } from './supabase';
import { deriveWithWinner, factsFromRow, type HoldDerivedStatus } from './vehicle-status';

export type FleetStatus =
  | 'pre-existing'
  | 'on-exception'
  | 'held'
  | 'sale-car'
  | 'auction-short-term'
  | 'dirty'
  | 'available'
  | 'clear';

export interface FleetVehicle {
  id: string;
  unitNumber: string | null;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: FleetStatus;
  holdCount: number;
  holdSummary: string[];
  holdId?: string;
  holdType?: string;
  holdFlaggedAt?: string;
  branchId: string;
  isTesla: boolean;
  hasMobileCable: boolean | null;
  hasJ1772Adapter: boolean | null;
}

export const STATUS_ORDER: Record<FleetStatus, number> = {
  held: 0, 'sale-car': 1, 'auction-short-term': 2, 'pre-existing': 3, 'on-exception': 4, dirty: 5, available: 6, clear: 7,
};

export interface HoldRow {
  id: string;
  vehicle_id: string;
  hold_types: string[] | null;
  status: string;
  created_at: string;
  releases: Array<{ release_type: string; actual_return: string | null }> | null;
}

export interface FleetVehicleRow {
  id: string;
  unit_number: string | null;
  license_plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  branch_id: string | null;
  is_tesla: boolean;
  has_mobile_cable: boolean | null;
  has_j1772_adapter: boolean | null;
}

function fmtType(t: string): string {
  return t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Deduplicated type labels across a set of holds
function allTypeLabels(hs: HoldRow[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const h of hs) {
    for (const t of (h.hold_types ?? [])) {
      const label = fmtType(t);
      if (!seen.has(label)) { seen.add(label); out.push(label); }
    }
  }
  return out.length > 0 ? out : ['Hold'];
}

// Fixed display labels for non-'held' statuses (held uses allTypeLabels over active holds)
const FIXED_LABELS: Partial<Record<HoldDerivedStatus, string[]>> = {
  'sale-car':           ['Sale Car'],
  'auction-short-term': ['Auction'],
  'pre-existing':       ['Pre-existing'],
  'on-exception':       ['Exception'],
};

/**
 * Pure status-resolution for the fleet master view. Given the raw vehicle and
 * hold rows plus today's inventory plate→status map, resolves each vehicle's
 * status by priority cascade and returns the list sorted by STATUS_ORDER then
 * plate. No I/O — `loadFleet` fetches the inputs and delegates here.
 *
 * Priority: regular ACTIVE hold (held) > ACTIVE sale_car (sale-car) >
 * released sale_car on exception (auction-short-term) > hold released as
 * PRE_EXISTING (pre-existing) > released exception (on-exception) >
 * inventory fallback (held / dirty / available) > clear.
 * Auction beats pre-existing: a car going to auction as-is should show
 * its auction status regardless of any pre-existing damage flags.
 * Pre-existing is a release decision (damage accepted as-is, vehicle stays
 * in circulation), never a hold_type — detect it from the release record.
 */
export function buildFleetView(
  vehicles: FleetVehicleRow[],
  holds: HoldRow[],
  inventoryMap: Map<string, string>,
): FleetVehicle[] {
  // All holds per vehicle
  const holdsByVehicle = new Map<string, HoldRow[]>();
  for (const hold of holds) {
    const existing = holdsByVehicle.get(hold.vehicle_id) ?? [];
    holdsByVehicle.set(hold.vehicle_id, [...existing, hold]);
  }

  const result: FleetVehicle[] = vehicles.map(v => {
    const vehicleHolds = holdsByVehicle.get(v.id) ?? [];

    let status: FleetStatus = 'clear';
    let holdId: string | undefined;
    let holdType: string | undefined;
    let holdFlaggedAt: string | undefined;
    let holdCount = 0;
    let holdSummary: string[] = [];

    const { status: derived, group: winGroup } = deriveWithWinner(
      vehicleHolds.map(h => ({ facts: factsFromRow(h), hold: h }))
    );
    const winner = [...winGroup].sort((a, b) => a.created_at.localeCompare(b.created_at))[0] ?? null;

    if (winner !== null) {
      status = derived as FleetStatus;
      holdId = winner.id;
      holdFlaggedAt = winner.created_at;
      if (derived === 'held') {
        // holdCount/holdSummary aggregate all active holds (sale-car included)
        const allActive = vehicleHolds.filter(h => h.status === 'ACTIVE');
        holdCount = allActive.length;
        holdSummary = allTypeLabels(allActive);
      } else {
        holdCount = winGroup.length;
        holdSummary = FIXED_LABELS[derived] ?? ['Hold'];
      }
      holdType = holdSummary[0];
    }
    // winner === null → derived is 'clear' → fall through to inventory

    if (status === 'clear') {
      const inv = inventoryMap.get(v.license_plate.toUpperCase());
      if (inv === 'B' || inv === 'M') status = 'held';
      else if (inv === 'D') status = 'dirty';
      else if (inv === 'A') status = 'available';
    }

    return {
      id: v.id,
      unitNumber: v.unit_number,
      licensePlate: v.license_plate,
      make: v.make,
      model: v.model,
      year: v.year,
      color: v.color,
      status,
      holdCount,
      holdSummary,
      holdId,
      holdType,
      holdFlaggedAt,
      branchId:        v.branch_id ?? 'YWG',
      isTesla:         v.is_tesla,
      hasMobileCable:  v.has_mobile_cable,
      hasJ1772Adapter: v.has_j1772_adapter,
    };
  });

  return result.sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return sd !== 0 ? sd : a.licensePlate.localeCompare(b.licensePlate);
  });
}

export async function loadFleet(branchId: string): Promise<FleetVehicle[]> {
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

  const [vehiclesRes, holdsRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('id, unit_number, license_plate, make, model, year, color, branch_id, is_tesla, has_mobile_cable, has_j1772_adapter')
      .eq('branch_id', branchId),
    supabase
      .from('holds')
      .select('id, vehicle_id, hold_types, status, created_at, releases(release_type, actual_return)')
      .eq('branch_id', branchId)
      .in('status', ['ACTIVE', 'RELEASED']),
  ]);

  const vehicles = (vehiclesRes.data ?? []) as unknown as FleetVehicleRow[];
  const holds = (holdsRes.data ?? []) as unknown as HoldRow[];

  // Build inventory plate→status map from today's session
  const inventoryMap = new Map<string, string>();
  try {
    const { data: sessionRow } = await supabase
      .from('inventory_sessions')
      .select('entry_data')
      .eq('branch_id', branchId)
      .eq('session_date', today)
      .maybeSingle();
    if (sessionRow?.entry_data) {
      for (const entry of sessionRow.entry_data as Array<Record<string, unknown>>) {
        if (entry.licensePlate && entry.status) {
          inventoryMap.set(String(entry.licensePlate).toUpperCase(), String(entry.status));
        }
      }
    }
  } catch { /* inventory_sessions not yet deployed — skip priorities 4–6 */ }

  return buildFleetView(vehicles, holds, inventoryMap);
}
