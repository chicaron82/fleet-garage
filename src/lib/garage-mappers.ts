import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldStatus, HoldType, DetailReason, ReleaseType, ReleaseMethod } from '../types';

// ── Lean runtime guards ────────────────────────────────────────────────────
// Trust boundary between Supabase rows and typed app models. If the schema
// drifts or a column is nullable we didn't expect, these throw with a clear
// message naming the mapper + field — no more silent `undefined` masquerading
// as a typed value at runtime.

type Row = Record<string, unknown>;

function reqStr(row: Row, key: string, where: string): string {
  const v = row[key];
  if (typeof v !== 'string') throw new Error(`${where}: expected string at '${key}', got ${typeof v}`);
  return v;
}

function reqNum(row: Row, key: string, where: string): number {
  const v = row[key];
  if (typeof v !== 'number') throw new Error(`${where}: expected number at '${key}', got ${typeof v}`);
  return v;
}

function optStr(row: Row, key: string): string | undefined {
  const v = row[key];
  return typeof v === 'string' ? v : undefined;
}

function optStrArray(row: Row, key: string): string[] {
  const v = row[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

// ── Mappers ────────────────────────────────────────────────────────────────

export function mapVehicle(row: Row): Vehicle {
  return {
    id:           reqStr(row, 'id',            'mapVehicle'),
    unitNumber:   reqStr(row, 'unit_number',   'mapVehicle'),
    licensePlate: reqStr(row, 'license_plate', 'mapVehicle'),
    make:         reqStr(row, 'make',          'mapVehicle'),
    model:        reqStr(row, 'model',         'mapVehicle'),
    year:         reqNum(row, 'year',          'mapVehicle'),
    color:        reqStr(row, 'color',         'mapVehicle'),
    status:       reqStr(row, 'status',        'mapVehicle') as VehicleStatus,
    branchId:     (optStr(row, 'branch_id')    ?? 'YWG') as any, // Mock fallback
  };
}

export function mapRelease(row: Row): Release {
  return {
    id:                     reqStr(row, 'id',              'mapRelease'),
    holdId:                 reqStr(row, 'hold_id',         'mapRelease'),
    approvedById:           reqStr(row, 'approved_by_id',  'mapRelease'),
    approvedAt:             reqStr(row, 'approved_at',     'mapRelease'),
    releaseType:            (optStr(row, 'release_type')   ?? 'EXCEPTION') as ReleaseType,
    releaseMethod:          (optStr(row, 'release_method') ?? 'standard')  as ReleaseMethod,
    overrideAuthorization:  optStr(row, 'override_authorization'),
    reason:                 reqStr(row, 'reason',          'mapRelease'),
    expectedReturn:         optStr(row, 'expected_return'),
    actualReturn:           optStr(row, 'actual_return'),
    notes:                  reqStr(row, 'notes',           'mapRelease'),
  };
}

export function mapRepair(row: Row): Repair {
  return {
    id:            reqStr(row, 'id',              'mapRepair'),
    holdId:        reqStr(row, 'hold_id',         'mapRepair'),
    repairedById:  reqStr(row, 'repaired_by_id',  'mapRepair'),
    repairedAt:    reqStr(row, 'repaired_at',     'mapRepair'),
    notes:         optStr(row, 'notes') ?? '',
  };
}

export function mapHold(row: Row): Hold {
  const releases = row.releases as Row[] | undefined;
  const repairs  = row.repairs  as Row[] | undefined;
  return {
    id:                 reqStr(row, 'id',                 'mapHold'),
    vehicleId:          reqStr(row, 'vehicle_id',         'mapHold'),
    holdType:           (optStr(row, 'hold_type') ?? 'damage') as HoldType,
    detailReason:       optStr(row, 'detail_reason') as DetailReason | undefined,
    damageDescription:  reqStr(row, 'damage_description', 'mapHold'),
    flaggedById:        reqStr(row, 'flagged_by_id',      'mapHold'),
    flaggedAt:          reqStr(row, 'flagged_at',         'mapHold'),
    notes:              reqStr(row, 'notes',              'mapHold'),
    photos:             optStrArray(row, 'photos'),
    status:             reqStr(row, 'status',             'mapHold') as HoldStatus,
    linkedHoldId:       optStr(row, 'linked_hold_id'),
    release:            releases?.[0] ? mapRelease(releases[0]) : undefined,
    repair:             repairs?.[0]  ? mapRepair(repairs[0])   : undefined,
    branchId:           (optStr(row, 'branch_id') ?? 'YWG') as any, // Mock fallback
  };
}
