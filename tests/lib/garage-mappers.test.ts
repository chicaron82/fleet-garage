import { describe, expect, it } from 'vitest';
import {
  mapHold, mapRelease, mapRepair, mapVehicle,
  mapIssue, mapWashbayLog, mapHandoffNote, mapLostFoundItem, mapCheckpoint,
} from '../../src/lib/garage-mappers';

const vehicleRow = {
  id: 'v1',
  unit_number: '5513130',
  license_plate: 'LJF684',
  make: 'Tesla',
  model: 'Model Y',
  year: 2022,
  color: 'Black',
  status: 'HELD',
  branch_id: 'YWG',
};

const releaseRow = {
  id: 'r1',
  hold_id: 'h1',
  approved_by_id: 'u6',
  approved_at: '2026-04-26T20:00:00Z',
  release_type: 'PRE_EXISTING',
  release_method: 'verbal_override',
  override_authorization: 'ZeeRah',
  reason: 'Known dent',
  expected_return: null,
  actual_return: '2026-04-27',
  notes: 'Logged by VSA',
};

const repairRow = {
  id: 'rep1',
  hold_id: 'h1',
  repaired_by_id: 'u6',
  repaired_at: '2026-04-27T15:00:00Z',
  notes: null,
};

const holdRow = {
  id: 'h1',
  vehicle_id: 'v1',
  hold_type: 'damage',
  detail_reason: null,
  damage_description: 'Rear liftgate dent',
  flagged_by_id: 'u1',
  flagged_at: '2026-04-26T19:00:00Z',
  notes: 'Same rear dent',
  photos: ['photo-a.jpg', 123, 'photo-b.jpg'],
  status: 'RELEASED',
  linked_hold_id: null,
  branch_id: 'YYC',
  releases: [releaseRow],
  repairs: [repairRow],
};

const issueRow = {
  id: 'i1', branch_id: 'YWG', title: 'Broken door',
  severity: 'high', reported_by: 'u1', reported_at: '2026-04-14T09:00:00',
};

const washbayRow = {
  id: 'w1', branch_id: 'YWG', date: '2026-04-14',
  full_pages: 3, last_page_entries: 7, cars_remaining: 2,
  clean_not_picked_up: 5, team_size: 4, shift_hours: 8,
  logged_by: 'u1', logged_at: '2026-04-14T17:00:00',
};

const handoffRow = {
  id: 'n1', branch_id: 'YWG', logged_by: 'u1', logged_by_name: 'Belle',
  logged_at: '2026-04-14T17:00:00', full_pages: 2, last_page_entries: 5,
  team_size: 3, lot_status: 'manageable',
};

const lostFoundRow = {
  id: 'lf1', branch_id: 'YWG', found_by: 'u1', found_by_name: 'Tori',
  found_at: '2026-04-14T11:00:00', status: 'holding',
};

describe('mapVehicle', () => {
  it('maps Supabase vehicle rows into app vehicles', () => {
    expect(mapVehicle(vehicleRow)).toMatchObject({
      id: 'v1',
      unitNumber: '5513130',
      licensePlate: 'LJF684',
      status: 'HELD',
      branchId: 'YWG',
    });
  });

  it('falls back to YWG for legacy branchless vehicle rows', () => {
    const legacyRow = { ...vehicleRow };
    delete (legacyRow as Record<string, unknown>).branch_id;
    expect(mapVehicle(legacyRow).branchId).toBe('YWG');
  });

  it('throws a clear mapper error when required vehicle fields are missing', () => {
    expect(() => mapVehicle({ ...vehicleRow, license_plate: undefined })).toThrow(
      "mapVehicle: expected string at 'license_plate'",
    );
  });

  it('tolerates a missing unit_number (legacy / not-yet-assigned rows)', () => {
    expect(mapVehicle({ ...vehicleRow, unit_number: undefined }).unitNumber).toBeNull();
  });

  it('throws when a required number is the wrong type', () => {
    expect(() => mapVehicle({ ...vehicleRow, year: 'bad' })).toThrow(
      "mapVehicle: expected number at 'year'",
    );
  });
});

describe('mapRelease and mapRepair', () => {
  it('maps release rows including verbal override fields', () => {
    expect(mapRelease(releaseRow)).toEqual({
      id: 'r1',
      holdId: 'h1',
      approvedById: 'u6',
      approvedAt: '2026-04-26T20:00:00Z',
      releaseType: 'PRE_EXISTING',
      releaseMethod: 'verbal_override',
      overrideAuthorization: 'ZeeRah',
      reason: 'Known dent',
      expectedReturn: undefined,
      actualReturn: '2026-04-27',
      notes: 'Logged by VSA',
    });
  });

  it('defaults older release rows to standard exception releases', () => {
    const legacyRow = { ...releaseRow };
    delete (legacyRow as Record<string, unknown>).release_type;
    delete (legacyRow as Record<string, unknown>).release_method;
    const release = mapRelease(legacyRow);
    expect(release.releaseType).toBe('EXCEPTION');
    expect(release.releaseMethod).toBe('standard');
  });

  it('maps repair required fields', () => {
    const r = mapRepair(repairRow);
    expect(r.id).toBe('rep1');
    expect(r.repairedById).toBe('u6');
  });

  it('maps null repair notes to an empty string', () => {
    expect(mapRepair(repairRow).notes).toBe('');
  });
});

describe('mapHold', () => {
  it('maps holds with nested release and repair records', () => {
    const hold = mapHold(holdRow);
    expect(hold).toMatchObject({
      id: 'h1',
      vehicleId: 'v1',
      holdType: 'damage',
      damageDescription: 'Rear liftgate dent',
      status: 'RELEASED',
      branchId: 'YYC',
    });
    expect(hold.photos).toEqual(['photo-a.jpg', 'photo-b.jpg']);
    expect(hold.release?.id).toBe('r1');
    expect(hold.repair?.id).toBe('rep1');
  });

  it('falls back to YWG for legacy branchless hold rows', () => {
    const legacyRow = { ...holdRow };
    delete (legacyRow as Record<string, unknown>).branch_id;
    expect(mapHold(legacyRow).branchId).toBe('YWG');
  });

  it('defaults older hold rows to damage holds', () => {
    const legacyRow = { ...holdRow };
    delete (legacyRow as Record<string, unknown>).hold_type;
    expect(mapHold(legacyRow).holdType).toBe('damage');
  });

  it('falls back hold_types to hold_type when the array is empty', () => {
    expect(mapHold({ ...holdRow, hold_types: [] }).holdTypes).toEqual(['damage']);
  });

  it('leaves release undefined when the releases array is empty', () => {
    expect(mapHold({ ...holdRow, releases: [] }).release).toBeUndefined();
  });
});

describe('mapIssue', () => {
  it('maps required fields', () => {
    const i = mapIssue(issueRow);
    expect(i.id).toBe('i1');
    expect(i.severity).toBe('high');
    expect(i.reportedById).toBe('u1');
  });
  it('maps optional cleared fields as undefined when absent', () => {
    const i = mapIssue(issueRow);
    expect(i.clearedById).toBeUndefined();
    expect(i.clearedAt).toBeUndefined();
  });
});

describe('mapWashbayLog', () => {
  it('maps all numeric fields', () => {
    const w = mapWashbayLog(washbayRow);
    expect(w.fullPages).toBe(3);
    expect(w.lastPageEntries).toBe(7);
    expect(w.carsRemaining).toBe(2);
    expect(w.cleanNotPickedUp).toBe(5);
    expect(w.teamSize).toBe(4);
    expect(w.shiftHours).toBe(8);
  });
});

describe('mapHandoffNote', () => {
  it('maps required fields', () => {
    const n = mapHandoffNote(handoffRow);
    expect(n.loggedByName).toBe('Belle');
    expect(n.lotStatus).toBe('manageable');
    expect(n.teamSize).toBe(3);
  });
  it('falls back lotStatus to manageable when missing', () => {
    const n = mapHandoffNote({ ...handoffRow, lot_status: undefined });
    expect(n.lotStatus).toBe('manageable');
  });
});

describe('mapLostFoundItem', () => {
  it('maps required fields', () => {
    const lf = mapLostFoundItem(lostFoundRow);
    expect(lf.id).toBe('lf1');
    expect(lf.foundByName).toBe('Tori');
    expect(lf.status).toBe('holding');
  });
  it('maps optional photo URLs as undefined when absent', () => {
    const lf = mapLostFoundItem(lostFoundRow);
    expect(lf.keyTagPhotoUrl).toBeUndefined();
    expect(lf.itemPhotoUrl).toBeUndefined();
  });
  it('maps optional photo URLs when present', () => {
    const lf = mapLostFoundItem({ ...lostFoundRow, key_tag_photo: 'https://cdn/kt.jpg', item_photo: 'https://cdn/item.jpg' });
    expect(lf.keyTagPhotoUrl).toBe('https://cdn/kt.jpg');
    expect(lf.itemPhotoUrl).toBe('https://cdn/item.jpg');
  });
  it('throws on missing required field', () => {
    expect(() => mapLostFoundItem({ ...lostFoundRow, status: undefined })).toThrow("mapLostFoundItem: expected string at 'status'");
  });
});

// ⭐⭐⭐ THE DRIFT THIS CLOSES. `mapVehicle` is the trust boundary every Supabase row
// crosses to become a `Vehicle` — and between 2026-06-01 and 2026-08-29 its source took
// 22 commits while this file took none. It grew from 9 mapped fields to 43; the tests
// above still assert the June nine. Nothing failed, nothing lied, and the file's NAME
// went on claiming it covered the mapper. That is what stale looks like in a green suite.
//
// So the fix is a mechanism, not a promise to remember: the census below fails the moment
// a 44th field appears, in CI, at the commit that adds it — the same shape as
// `tests/lib-coverage-canary.test.ts`. A new column cannot land unasserted again.

const fullVehicleRow = {
  id: 'v9', unit_number: '5747498', license_plate: 'ZZZ999', make: 'Toyota',
  model: 'Sienna', year: 2026, color: 'Silver', status: 'AVAILABLE', branch_id: 'YWG',
  rental_class: 'E6', field_sources: { rentalClass: 'tag', vinLast9: 'manual' },
  key_count: 2, class_code: 'CSLE', odometer: 41230, odometer_at: '2026-08-20T10:00:00Z',
  vin_last9: '0XX111111', is_us: false, winter_tires: true, winter_tires_at: '2026-01-05',
  keytag_audited_at: '2026-08-29T15:00:00Z', keytag_audited_by: 'u-aaron',
  keytag_audit_result: 'verified', keytag_photo_url: 'https://cdn/kt.jpg',
  note: 'Purge valve deferred', note_at: '2026-08-01T12:00:00Z', owning_area: '8199',
  is_tesla: false, is_hybrid: true, has_mobile_cable: null, has_j1772_adapter: null,
  ev_last_updated_by: null, ev_last_updated_at: null, cover_photo_url: 'https://cdn/c.jpg',
  archived_at: '2026-08-28T00:00:00Z', archived_by_id: 'u-aaron',
  edit_suggested_unit: '5747499', edit_suggested_plate: 'ZZZ998', edit_suggested_by: 'u2',
  edit_suggested_at: '2026-08-27T00:00:00Z', edit_suggestion_note: 'plate re-issued',
  edit_status: 'pending', edit_reviewed_by: 'u-aaron', edit_reviewed_at: '2026-08-28T01:00:00Z',
};

// Every key `mapVehicle` is contracted to produce. Adding a field here without mapping it
// (or mapping one without listing it) fails — deliberately, so the choice is conscious.
const VEHICLE_KEYS = [
  'archivedAt', 'archivedById', 'branchId', 'classCode', 'color', 'coverPhotoUrl',
  'editReviewedAt', 'editReviewedBy', 'editStatus', 'editSuggestedAt', 'editSuggestedBy',
  'editSuggestedPlate', 'editSuggestedUnit', 'editSuggestionNote', 'evLastUpdatedAt',
  'evLastUpdatedBy', 'fieldSources', 'hasJ1772Adapter', 'hasMobileCable', 'id', 'isHybrid',
  'isTesla', 'isUs', 'keyCount', 'keytagAuditResult', 'keytagAuditedAt', 'keytagAuditedBy',
  'keytagPhotoUrl', 'licensePlate', 'make', 'model', 'note', 'noteAt', 'odometer',
  'odometerAt', 'owningArea', 'rentalClass', 'status', 'unitNumber', 'vinLast9',
  'winterTires', 'winterTiresAt', 'year',
];

describe('mapVehicle — the full field contract', () => {
  it('⭐ produces exactly the contracted key set, and no more', () => {
    expect(Object.keys(mapVehicle(fullVehicleRow)).sort()).toEqual(VEHICLE_KEYS);
  });

  it('maps every column a populated row carries', () => {
    expect(mapVehicle(fullVehicleRow)).toEqual({
      id: 'v9', unitNumber: '5747498', licensePlate: 'ZZZ999', make: 'Toyota',
      model: 'Sienna', year: 2026, color: 'Silver', status: 'AVAILABLE', branchId: 'YWG',
      rentalClass: 'E6', fieldSources: { rentalClass: 'tag', vinLast9: 'manual' },
      keyCount: 2, classCode: 'CSLE', odometer: 41230, odometerAt: '2026-08-20T10:00:00Z',
      vinLast9: '0XX111111', isUs: false, winterTires: true, winterTiresAt: '2026-01-05',
      keytagAuditedAt: '2026-08-29T15:00:00Z', keytagAuditedBy: 'u-aaron',
      keytagAuditResult: 'verified', keytagPhotoUrl: 'https://cdn/kt.jpg',
      note: 'Purge valve deferred', noteAt: '2026-08-01T12:00:00Z', owningArea: '8199',
      isTesla: false, isHybrid: true, hasMobileCable: null, hasJ1772Adapter: null,
      evLastUpdatedBy: null, evLastUpdatedAt: null, coverPhotoUrl: 'https://cdn/c.jpg',
      archivedAt: '2026-08-28T00:00:00Z', archivedById: 'u-aaron',
      editSuggestedUnit: '5747499', editSuggestedPlate: 'ZZZ998', editSuggestedBy: 'u2',
      editSuggestedAt: '2026-08-27T00:00:00Z', editSuggestionNote: 'plate re-issued',
      editStatus: 'pending', editReviewedBy: 'u-aaron', editReviewedAt: '2026-08-28T01:00:00Z',
    });
  });

  // ⚠️ THREE absence conventions coexist in one function — `?? null`, `?? undefined`, and
  // bare `nullableStr`. Which one a field uses is a real contract (a `null` round-trips to
  // Supabase as a cleared column; an `undefined` is dropped from the payload), and until now
  // it was documented only by the line itself. Pinned so a tidy-up can't silently flip one.
  it('⚠️ holds the null-vs-undefined line for a sparse row', () => {
    const v = mapVehicle(vehicleRow);
    for (const k of ['rentalClass', 'classCode', 'vinLast9', 'odometer', 'odometerAt',
      'keyCount', 'winterTires', 'winterTiresAt', 'keytagAuditedAt', 'keytagAuditedBy',
      'keytagAuditResult', 'keytagPhotoUrl', 'note', 'noteAt', 'owningArea',
      'hasMobileCable', 'hasJ1772Adapter', 'evLastUpdatedBy', 'evLastUpdatedAt',
      'editStatus'] as const) {
      expect(v[k], `${k} must be null when absent, not undefined`).toBeNull();
    }
    for (const k of ['coverPhotoUrl', 'archivedAt', 'archivedById', 'editSuggestedPlate',
      'editSuggestedBy', 'editSuggestedAt', 'editSuggestionNote', 'editReviewedBy',
      'editReviewedAt'] as const) {
      expect(v[k], `${k} must be undefined when absent, not null`).toBeUndefined();
    }
    expect(v.fieldSources).toEqual({});
    expect(v.isUs).toBe(false);
    expect(v.isTesla).toBe(false);
    expect(v.isHybrid).toBe(false);
  });

  // ⭐⭐ `edit_suggested_unit` is the one field mapped with `'key' in row ? … : undefined`
  // rather than a plain read — a deliberate THREE-state: absent means "no opinion", an
  // explicit null means "clear the unit number", a string means "set it". Someone hit that
  // distinction and encoded the fix; nothing pinned it, so the next simplification erases it
  // and the suite stays green.
  it('⭐ distinguishes an ABSENT edit_suggested_unit from an explicit null', () => {
    expect(mapVehicle(vehicleRow).editSuggestedUnit).toBeUndefined();
    expect(mapVehicle({ ...vehicleRow, edit_suggested_unit: null }).editSuggestedUnit).toBeNull();
    expect(mapVehicle({ ...vehicleRow, edit_suggested_unit: '5747499' }).editSuggestedUnit).toBe('5747499');
  });
});

// ⭐ `mapCheckpoint` was exported and referenced by ZERO tests — the only mapper in the file
// with no coverage at all. Unlike `mapVehicle` it does NOT default a missing branch: it throws.
describe('mapCheckpoint', () => {
  const checkpointRow = {
    id: 'cp1', branch_id: 'YWG', date: '2026-08-29', checkpoint_type: 'afternoon',
    full_pages: 4, last_page_entries: 6, logged_by: 'u1', logged_at: '2026-08-29T14:00:00Z',
  };

  it('maps every checkpoint field', () => {
    expect(mapCheckpoint(checkpointRow)).toEqual({
      id: 'cp1', branchId: 'YWG', date: '2026-08-29', checkpointType: 'afternoon',
      fullPages: 4, lastPageEntries: 6, loggedBy: 'u1', loggedAt: '2026-08-29T14:00:00Z',
    });
  });

  it('throws a mapper error naming the missing field', () => {
    expect(() => mapCheckpoint({ ...checkpointRow, checkpoint_type: undefined })).toThrow(
      "mapCheckpoint: expected string at 'checkpoint_type'",
    );
  });

  it('⚠️ requires branch_id — a checkpoint does not inherit the YWG default', () => {
    const row = { ...checkpointRow };
    delete (row as Record<string, unknown>).branch_id;
    expect(() => mapCheckpoint(row)).toThrow("mapCheckpoint: expected string at 'branch_id'");
  });

  it('throws when a page count is not a number', () => {
    expect(() => mapCheckpoint({ ...checkpointRow, full_pages: '4' })).toThrow(
      "mapCheckpoint: expected number at 'full_pages'",
    );
  });
});
