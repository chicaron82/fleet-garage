import { describe, expect, it } from 'vitest';
import {
  mapHold, mapRelease, mapRepair, mapVehicle,
  mapIssue, mapWashbayLog, mapHandoffNote, mapLostFoundItem,
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
