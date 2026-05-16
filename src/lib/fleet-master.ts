import { supabase } from './supabase';

export type FleetStatus =
  | 'pre-existing'
  | 'on-exception'
  | 'held'
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
  held: 0, 'pre-existing': 1, 'on-exception': 2, dirty: 3, available: 4, clear: 5,
};

type HoldRow = {
  id: string;
  vehicle_id: string;
  hold_types: string[] | null;
  status: string;
  created_at: string;
  releases: Array<{ release_type: string; actual_return: string | null }> | null;
};

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

  const vehicles = vehiclesRes.data ?? [];
  const holds = (holdsRes.data ?? []) as HoldRow[];

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

  // All holds per vehicle
  const holdsByVehicle = new Map<string, HoldRow[]>();
  for (const hold of holds) {
    const existing = holdsByVehicle.get(hold.vehicle_id) ?? [];
    holdsByVehicle.set(hold.vehicle_id, [...existing, hold]);
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

  const result: FleetVehicle[] = vehicles.map(v => {
    const vehicleHolds = holdsByVehicle.get(v.id) ?? [];
    const activeHolds = vehicleHolds.filter(h => h.status === 'ACTIVE');
    const nonPreExActive = activeHolds.filter(h => !h.hold_types?.includes('pre-existing'));
    const preExActive = activeHolds.filter(h => h.hold_types?.includes('pre-existing'));
    const exceptionReleased = vehicleHolds.filter(h =>
      h.status === 'RELEASED' &&
      (h.releases ?? []).some(r => r.release_type === 'EXCEPTION' && !r.actual_return)
    );

    let status: FleetStatus = 'clear';
    let holdId: string | undefined;
    let holdType: string | undefined;
    let holdFlaggedAt: string | undefined;
    let holdCount = 0;
    let holdSummary: string[] = [];

    if (nonPreExActive.length > 0) {
      // ACTIVE non-pre-existing holds → held (earliest is primary for navigation)
      const sorted = nonPreExActive.sort((a, b) => a.created_at.localeCompare(b.created_at));
      status = 'held';
      holdId = sorted[0].id;
      holdFlaggedAt = sorted[0].created_at;
      holdCount = activeHolds.length;
      holdSummary = allTypeLabels(activeHolds);
      holdType = holdSummary[0];
    } else if (preExActive.length > 0) {
      // Only pre-existing ACTIVE holds
      const sorted = preExActive.sort((a, b) => a.created_at.localeCompare(b.created_at));
      status = 'pre-existing';
      holdId = sorted[0].id;
      holdFlaggedAt = sorted[0].created_at;
      holdCount = preExActive.length;
      holdSummary = ['Pre-existing'];
      holdType = 'Pre-existing';
    } else if (exceptionReleased.length > 0) {
      const sorted = exceptionReleased.sort((a, b) => a.created_at.localeCompare(b.created_at));
      status = 'on-exception';
      holdId = sorted[0].id;
      holdFlaggedAt = sorted[0].created_at;
      holdCount = exceptionReleased.length;
      holdSummary = ['Exception'];
      holdType = 'Exception';
    }
    // RELEASED hold with no active exception — fall through to inventory

    if (status === 'clear') {
      const inv = inventoryMap.get(v.license_plate.toUpperCase());
      if (inv === 'B' || inv === 'M') status = 'held';
      else if (inv === 'D') status = 'dirty';
      else if (inv === 'A') status = 'available';
    }

    return {
      id: v.id,
      unitNumber: v.unit_number as string | null,
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
      branchId:       v.branch_id,
      isTesla:        (v as Record<string, unknown>)['is_tesla']          as boolean        ?? false,
      hasMobileCable: (v as Record<string, unknown>)['has_mobile_cable']  as boolean | null ?? null,
      hasJ1772Adapter:(v as Record<string, unknown>)['has_j1772_adapter'] as boolean | null ?? null,
    };
  });

  return result.sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return sd !== 0 ? sd : a.licensePlate.localeCompare(b.licensePlate);
  });
}
