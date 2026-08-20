import type { Vehicle, Hold, Release, Repair, RepairOutcome, VehicleStatus, VehicleEditStatus, HoldStatus, HoldType, DetailReason, MechanicalSubType, ReleaseType, ReleaseMethod, BranchId, FacilityIssue, IssueSeverity, WashbayLog, HandoffNote, LotStatus, LostFoundItem, LostFoundStatus, LostFoundLocation, ShiftCheckpoint, FieldSource } from '../types';

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

// Returns string | null — distinct from optStr which returns string | undefined.
// Used for columns that are intentionally nullable (e.g. edit_suggested_unit can be null to mean "clear unit").
function nullableStr(row: Row, key: string): string | null {
  const v = row[key];
  if (typeof v === 'string') return v;
  return null;
}

// ── Mappers ────────────────────────────────────────────────────────────────

export function mapVehicle(row: Row): Vehicle {
  return {
    id:           reqStr(row, 'id',            'mapVehicle'),
    unitNumber:   nullableStr(row, 'unit_number'),
    licensePlate: reqStr(row, 'license_plate', 'mapVehicle'),
    make:         reqStr(row, 'make',          'mapVehicle'),
    model:        reqStr(row, 'model',         'mapVehicle'),
    year:         reqNum(row, 'year',          'mapVehicle'),
    color:        reqStr(row, 'color',         'mapVehicle'),
    rentalClass:  nullableStr(row, 'rental_class'),
    fieldSources: (row['field_sources'] as Record<string, FieldSource>) ?? {},
    keyCount:     (row['key_count'] as number | null) ?? null,
    classCode:    optStr(row, 'class_code') ?? null,
    keytagPhotoUrl: nullableStr(row, 'keytag_photo_url'),
    owningArea:     nullableStr(row, 'owning_area'),
    status:       reqStr(row, 'status',        'mapVehicle') as VehicleStatus,
    branchId:       (optStr(row, 'branch_id')    ?? 'YWG') as BranchId, // Mock fallback
    isTesla:        (row['is_tesla'] as boolean)          ?? false,
    isHybrid:       (row['is_hybrid'] as boolean)         ?? false,
    hasMobileCable: (row['has_mobile_cable'] as boolean | null) ?? null,
    hasJ1772Adapter:(row['has_j1772_adapter'] as boolean | null) ?? null,
    evLastUpdatedBy: (row['ev_last_updated_by'] as string | null) ?? null,
    evLastUpdatedAt: (row['ev_last_updated_at'] as string | null) ?? null,
    coverPhotoUrl: optStr(row, 'cover_photo_url'),
    archivedAt:   optStr(row, 'archived_at')    ?? undefined,
    archivedById: optStr(row, 'archived_by_id') ?? undefined,
    editSuggestedUnit:  'edit_suggested_unit'  in row ? nullableStr(row, 'edit_suggested_unit') : undefined,
    editSuggestedPlate: optStr(row, 'edit_suggested_plate'),
    editSuggestedBy:    optStr(row, 'edit_suggested_by'),
    editSuggestedAt:    optStr(row, 'edit_suggested_at'),
    editSuggestionNote: optStr(row, 'edit_suggestion_note'),
    editStatus:         (optStr(row, 'edit_status') as VehicleEditStatus | undefined) ?? null,
    editReviewedBy:     optStr(row, 'edit_reviewed_by'),
    editReviewedAt:     optStr(row, 'edit_reviewed_at'),
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
    outcome:       (optStr(row, 'outcome') ?? 'clean') as RepairOutcome,
  };
}

export function mapIssue(row: Row): FacilityIssue {
  return {
    id:           reqStr(row, 'id',          'mapIssue'),
    branchId:     reqStr(row, 'branch_id',   'mapIssue') as BranchId,
    title:        reqStr(row, 'title',       'mapIssue'),
    description:  optStr(row, 'description'),
    severity:     reqStr(row, 'severity',    'mapIssue') as IssueSeverity,
    reportedById: reqStr(row, 'reported_by', 'mapIssue'),
    reportedAt:   reqStr(row, 'reported_at', 'mapIssue'),
    clearedById:  optStr(row, 'cleared_by'),
    clearedAt:    optStr(row, 'cleared_at'),
    notes:        optStr(row, 'notes'),
    photoUrl:     optStr(row, 'photo_url'),
    status:       ((row.status as string) ?? 'open') as 'open' | 'resolved' | 'reopened',
    reopenCount:  (row.reopen_count as number) ?? 0,
  };
}

export function mapWashbayLog(row: Row): WashbayLog {
  return {
    id:                reqStr(row, 'id',                  'mapWashbayLog'),
    branchId:          reqStr(row, 'branch_id',           'mapWashbayLog') as BranchId,
    date:              reqStr(row, 'date',                'mapWashbayLog'),
    fullPages:         reqNum(row, 'full_pages',          'mapWashbayLog'),
    lastPageEntries:   reqNum(row, 'last_page_entries',   'mapWashbayLog'),
    carsRemaining:     reqNum(row, 'cars_remaining',      'mapWashbayLog'),
    cleanNotPickedUp:  reqNum(row, 'clean_not_picked_up', 'mapWashbayLog'),
    nonRentablesFuelled: (row['non_rentables_fuelled'] as number) ?? 0,
    deferredCompletions: (row['deferred_completions']  as number) ?? 0,
    nonRentablesNote:    optStr(row, 'non_rentables_note'),
    carryOver:           (row['carry_over']            as number) ?? 0,
    teamSize:          reqNum(row, 'team_size',           'mapWashbayLog'),
    shiftHours:        Number(row['shift_hours']),
    overtimeHours:     (row['overtime_hours'] as number) ?? 0,
    lotStatus:         (optStr(row, 'lot_status') ?? 'manageable') as LotStatus,
    photoUrl:          nullableStr(row, 'photo_url'),
    airportFlipping:   (row['airport_flipping'] as boolean) ?? false,
    loggedById:        reqStr(row, 'logged_by',           'mapWashbayLog'),
    loggedAt:          reqStr(row, 'logged_at',           'mapWashbayLog'),
  };
}

export function mapHold(row: Row): Hold {
  const releases = row.releases as Row[] | undefined;
  const repairs  = row.repairs  as Row[] | undefined;
  const rawTypes = optStrArray(row, 'hold_types');
  const holdTypes = rawTypes.length > 0
    ? rawTypes as HoldType[]
    : [(optStr(row, 'hold_type') ?? 'damage') as HoldType];
  return {
    id:                 reqStr(row, 'id',                 'mapHold'),
    vehicleId:          reqStr(row, 'vehicle_id',         'mapHold'),
    holdTypes,
    holdType:           holdTypes[0],
    resolvedTypes:      optStrArray(row, 'resolved_types') as HoldType[],
    detailReason:       optStr(row, 'detail_reason') as DetailReason | undefined,
    mechanicalSubType:  optStr(row, 'mechanical_sub_type') as MechanicalSubType | undefined,
    damageDescription:  reqStr(row, 'damage_description', 'mapHold'),
    flaggedById:          reqStr(row, 'flagged_by_id',          'mapHold'),
    flaggedByName:        optStr(row, 'flagged_by_name')        ?? '',
    flaggedByEmployeeId:  optStr(row, 'flagged_by_employee_id') ?? '',
    flaggedSource:        optStr(row, 'flagged_source')         ?? null,
    flaggedAt:            reqStr(row, 'flagged_at',             'mapHold'),
    notes:              reqStr(row, 'notes',              'mapHold'),
    photos:             optStrArray(row, 'photos'),
    status:             reqStr(row, 'status',             'mapHold') as HoldStatus,
    linkedHoldId:       optStr(row, 'linked_hold_id'),
    release:                 releases?.[0] ? mapRelease(releases[0]) : undefined,
    repair:                  repairs?.[0]  ? mapRepair(repairs[0])   : undefined,
    branchId:                (optStr(row, 'branch_id') ?? 'YWG') as BranchId,
    offstandardLinked:       row['offstandard_linked'] === true,
    cleanedInhouseLoggedAt:  optStr(row, 'cleaned_inhouse_logged_at'),
  };
}

export function mapHandoffNote(row: Row): HandoffNote {
  return {
    id:               reqStr(row, 'id',               'mapHandoffNote'),
    branchId:         reqStr(row, 'branch_id',        'mapHandoffNote'),
    loggedById:       reqStr(row, 'logged_by',        'mapHandoffNote'),
    loggedByName:     reqStr(row, 'logged_by_name',   'mapHandoffNote'),
    loggedAt:         reqStr(row, 'logged_at',        'mapHandoffNote'),
    fullPages:        reqNum(row, 'full_pages',        'mapHandoffNote'),
    lastPageEntries:  reqNum(row, 'last_page_entries', 'mapHandoffNote'),
    teamSize:         reqNum(row, 'team_size',         'mapHandoffNote'),
    notes:            optStr(row, 'notes'),
    lotStatus:        (optStr(row, 'lot_status') ?? 'manageable') as LotStatus,
    photoUrl:         nullableStr(row, 'photo_url'),
    morningHours:     (row['morning_hours'] as number) ?? 8.5,
    carryOverCleared: (row['carry_over_cleared'] as number) ?? 0,
    airportFlipping:  (row['airport_flipping'] as boolean) ?? false,
  };
}

export function mapCheckpoint(row: Row): ShiftCheckpoint {
  return {
    id:              reqStr(row, 'id',                'mapCheckpoint'),
    branchId:        reqStr(row, 'branch_id',         'mapCheckpoint'),
    date:            reqStr(row, 'date',              'mapCheckpoint'),
    checkpointType:  reqStr(row, 'checkpoint_type',   'mapCheckpoint'),
    fullPages:       reqNum(row, 'full_pages',        'mapCheckpoint'),
    lastPageEntries: reqNum(row, 'last_page_entries', 'mapCheckpoint'),
    loggedBy:        reqStr(row, 'logged_by',         'mapCheckpoint'),
    loggedAt:        reqStr(row, 'logged_at',         'mapCheckpoint'),
  };
}

export function mapLostFoundItem(row: Row): LostFoundItem {
  return {
    id:             reqStr(row, 'id',             'mapLostFoundItem'),
    branchId:       reqStr(row, 'branch_id',      'mapLostFoundItem'),
    foundById:      reqStr(row, 'found_by',       'mapLostFoundItem'),
    foundByName:    reqStr(row, 'found_by_name',  'mapLostFoundItem'),
    foundAt:        reqStr(row, 'found_at',       'mapLostFoundItem'),
    keyTagPhotoUrl: optStr(row, 'key_tag_photo'),
    itemPhotoUrl:   optStr(row, 'item_photo'),
    description:    optStr(row, 'description'),
    location:       optStr(row, 'location') as LostFoundLocation | undefined,
    licensePlate:   optStr(row, 'license_plate'),
    unitNumber:     optStr(row, 'unit_number'),
    vehicleMake:    optStr(row, 'vehicle_make'),
    status:         reqStr(row, 'status',         'mapLostFoundItem') as LostFoundStatus,
    notes:          optStr(row, 'notes'),
    resolvedAt:     optStr(row, 'resolved_at'),
    editedByName:   optStr(row, 'edited_by_name'),
    editedAt:       optStr(row, 'edited_at'),
  };
}
