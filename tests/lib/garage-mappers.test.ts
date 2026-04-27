import { describe, expect, it } from 'vitest';
import { mapHold, mapRelease, mapRepair, mapVehicle } from '../../src/lib/garage-mappers';

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
    const { branch_id: _branchId, ...legacyRow } = vehicleRow;
    expect(mapVehicle(legacyRow).branchId).toBe('YWG');
  });

  it('throws a clear mapper error when required vehicle fields are missing', () => {
    expect(() => mapVehicle({ ...vehicleRow, unit_number: undefined })).toThrow(
      "mapVehicle: expected string at 'unit_number'",
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
    const { release_type: _releaseType, release_method: _releaseMethod, ...legacyRow } = releaseRow;
    const release = mapRelease(legacyRow);
    expect(release.releaseType).toBe('EXCEPTION');
    expect(release.releaseMethod).toBe('standard');
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
    const { branch_id: _branchId, ...legacyRow } = holdRow;
    expect(mapHold(legacyRow).branchId).toBe('YWG');
  });

  it('defaults older hold rows to damage holds', () => {
    const { hold_type: _holdType, ...legacyRow } = holdRow;
    expect(mapHold(legacyRow).holdType).toBe('damage');
  });
});
