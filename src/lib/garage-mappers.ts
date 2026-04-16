import type { Vehicle, Hold, Release, Repair, VehicleStatus, HoldStatus, HoldType, DetailReason, ReleaseType, ReleaseMethod } from '../types';

export function mapVehicle(row: Record<string, unknown>): Vehicle {
  return {
    id:           row.id as string,
    unitNumber:   row.unit_number as string,
    licensePlate: row.license_plate as string,
    make:         row.make as string,
    model:        row.model as string,
    year:         row.year as number,
    color:        row.color as string,
    status:       row.status as VehicleStatus,
  };
}

export function mapRelease(row: Record<string, unknown>): Release {
  return {
    id:                     row.id as string,
    holdId:                 row.hold_id as string,
    approvedById:           row.approved_by_id as string,
    approvedAt:             row.approved_at as string,
    releaseType:            ((row.release_type as string) ?? 'EXCEPTION') as ReleaseType,
    releaseMethod:          ((row.release_method as string) ?? 'standard') as ReleaseMethod,
    overrideAuthorization:  (row.override_authorization as string) ?? undefined,
    reason:                 row.reason as string,
    expectedReturn:         (row.expected_return as string) ?? undefined,
    actualReturn:           (row.actual_return as string) ?? undefined,
    notes:                  row.notes as string,
  };
}

export function mapRepair(row: Record<string, unknown>): Repair {
  return {
    id:            row.id as string,
    holdId:        row.hold_id as string,
    repairedById:  row.repaired_by_id as string,
    repairedAt:    row.repaired_at as string,
    notes:         (row.notes as string) ?? '',
  };
}

export function mapHold(row: Record<string, unknown>): Hold {
  const releases = row.releases as Record<string, unknown>[] | undefined;
  const repairs  = row.repairs  as Record<string, unknown>[] | undefined;
  return {
    id:                 row.id as string,
    vehicleId:          row.vehicle_id as string,
    holdType:           ((row.hold_type as string) ?? 'damage') as HoldType,
    detailReason:       (row.detail_reason as DetailReason) ?? undefined,
    damageDescription:  row.damage_description as string,
    flaggedById:        row.flagged_by_id as string,
    flaggedAt:          row.flagged_at as string,
    notes:              row.notes as string,
    photos:             (row.photos as string[]) ?? [],
    status:             row.status as HoldStatus,
    linkedHoldId:       (row.linked_hold_id as string) ?? undefined,
    release:            releases?.[0] ? mapRelease(releases[0]) : undefined,
    repair:             repairs?.[0]  ? mapRepair(repairs[0])   : undefined,
  };
}
