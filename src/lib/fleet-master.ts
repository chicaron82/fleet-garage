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
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: FleetStatus;
  holdId?: string;
  holdType?: string;
  holdFlaggedAt?: string;
  branchId: string;
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
      .select('id, unit_number, license_plate, make, model, year, color, branch_id')
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

  // One hold per vehicle — ACTIVE wins over RELEASED
  const holdsByVehicle = new Map<string, HoldRow>();
  for (const hold of holds) {
    const existing = holdsByVehicle.get(hold.vehicle_id);
    if (!existing || (hold.status === 'ACTIVE' && existing.status === 'RELEASED')) {
      holdsByVehicle.set(hold.vehicle_id, hold);
    }
  }

  const result: FleetVehicle[] = vehicles.map(v => {
    const hold = holdsByVehicle.get(v.id);
    let status: FleetStatus = 'clear';
    let holdId: string | undefined;
    let holdType: string | undefined;
    let holdFlaggedAt: string | undefined;

    if (hold) {
      const holdTypes = Array.isArray(hold.hold_types) ? hold.hold_types : [];
      const releases = hold.releases ?? [];

      if (hold.status === 'ACTIVE' && holdTypes.includes('pre-existing')) {
        status = 'pre-existing';
        holdId = hold.id;
        holdType = 'Pre-existing';
        holdFlaggedAt = hold.created_at;
      } else if (hold.status === 'RELEASED' && releases.some(r => r.release_type === 'EXCEPTION' && !r.actual_return)) {
        status = 'on-exception';
        holdId = hold.id;
        holdType = 'Exception';
        holdFlaggedAt = hold.created_at;
      } else if (hold.status === 'ACTIVE') {
        status = 'held';
        holdId = hold.id;
        holdType = holdTypes.length > 0
          ? holdTypes.map(t => t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')
          : 'Hold';
        holdFlaggedAt = hold.created_at;
      }
      // RELEASED hold with no active exception — fall through to inventory
    }

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
      holdId,
      holdType,
      holdFlaggedAt,
      branchId: v.branch_id,
    };
  });

  return result.sort((a, b) => {
    const sd = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    return sd !== 0 ? sd : a.licensePlate.localeCompare(b.licensePlate);
  });
}
