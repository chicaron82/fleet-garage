import { describe, it, expect } from 'vitest';
import {
  mapVehicle, mapHold, mapRelease, mapRepair,
  mapIssue, mapWashbayLog, mapHandoffNote, mapLostFoundItem,
} from './garage-mappers';

type Row = Record<string, unknown>;

const vehicleRow: Row = {
  id: 'v1', unit_number: 'HRZ-001', license_plate: 'MBK 331',
  make: 'Honda', model: 'HR-V', year: 2023, color: 'White',
  status: 'CLEAR', branch_id: 'YWG',
};

const releaseRow: Row = {
  id: 'r1', hold_id: 'h1', approved_by_id: 'u1', approved_at: '2026-04-14T10:00:00',
  release_type: 'EXCEPTION', release_method: 'standard',
  reason: 'Customer needed vehicle', notes: 'Approved by manager',
};

const repairRow: Row = {
  id: 'rp1', hold_id: 'h1', repaired_by_id: 'u2',
  repaired_at: '2026-04-15T09:00:00', notes: 'Panel replaced',
};

const holdRow: Row = {
  id: 'h1', vehicle_id: 'v1', hold_type: 'damage', hold_types: ['damage'],
  damage_description: 'Scratch on door', flagged_by_id: 'u1',
  flagged_at: '2026-04-14T08:00:00', notes: 'Deep scratch',
  photos: ['https://example.com/photo.jpg'], status: 'ACTIVE',
  branch_id: 'YWG', linked_hold_id: null,
  releases: [], repairs: [],
};

const issueRow: Row = {
  id: 'i1', branch_id: 'YWG', title: 'Broken door',
  severity: 'high', reported_by: 'u1', reported_at: '2026-04-14T09:00:00',
};

const washbayRow: Row = {
  id: 'w1', branch_id: 'YWG', date: '2026-04-14',
  full_pages: 3, last_page_entries: 7, cars_remaining: 2,
  clean_not_picked_up: 5, team_size: 4, shift_hours: 8,
  logged_by: 'u1', logged_at: '2026-04-14T17:00:00',
};

const handoffRow: Row = {
  id: 'n1', branch_id: 'YWG', logged_by: 'u1', logged_by_name: 'Belle',
  logged_at: '2026-04-14T17:00:00', full_pages: 2, last_page_entries: 5,
  team_size: 3, lot_status: 'manageable',
};

const lostFoundRow: Row = {
  id: 'lf1', branch_id: 'YWG', found_by: 'u1', found_by_name: 'Tori',
  found_at: '2026-04-14T11:00:00', status: 'holding',
};

describe('mapVehicle', () => {
  it('maps all required fields', () => {
    const v = mapVehicle(vehicleRow);
    expect(v.id).toBe('v1');
    expect(v.unitNumber).toBe('HRZ-001');
    expect(v.licensePlate).toBe('MBK 331');
    expect(v.year).toBe(2023);
    expect(v.branchId).toBe('YWG');
  });
  it('falls back branchId to YWG when missing', () => {
    const v = mapVehicle({ ...vehicleRow, branch_id: undefined });
    expect(v.branchId).toBe('YWG');
  });
  it('throws when required string is missing', () => {
    expect(() => mapVehicle({ ...vehicleRow, id: undefined })).toThrow("mapVehicle: expected string at 'id'");
  });
  it('throws when required number is wrong type', () => {
    expect(() => mapVehicle({ ...vehicleRow, year: 'bad' })).toThrow("mapVehicle: expected number at 'year'");
  });
});

describe('mapRelease', () => {
  it('maps required fields', () => {
    const r = mapRelease(releaseRow);
    expect(r.id).toBe('r1');
    expect(r.holdId).toBe('h1');
    expect(r.releaseType).toBe('EXCEPTION');
    expect(r.releaseMethod).toBe('standard');
  });
  it('falls back releaseType to EXCEPTION when missing', () => {
    const r = mapRelease({ ...releaseRow, release_type: undefined });
    expect(r.releaseType).toBe('EXCEPTION');
  });
  it('maps optional overrideAuthorization', () => {
    const r = mapRelease({ ...releaseRow, override_authorization: 'Manager Name' });
    expect(r.overrideAuthorization).toBe('Manager Name');
  });
});

describe('mapRepair', () => {
  it('maps required fields', () => {
    const r = mapRepair(repairRow);
    expect(r.id).toBe('rp1');
    expect(r.repairedById).toBe('u2');
  });
  it('defaults notes to empty string when absent', () => {
    const r = mapRepair({ ...repairRow, notes: undefined });
    expect(r.notes).toBe('');
  });
});

describe('mapHold', () => {
  it('maps required fields', () => {
    const h = mapHold(holdRow);
    expect(h.id).toBe('h1');
    expect(h.vehicleId).toBe('v1');
    expect(h.holdTypes).toEqual(['damage']);
    expect(h.holdType).toBe('damage');
    expect(h.photos).toEqual(['https://example.com/photo.jpg']);
  });
  it('falls back hold_types to hold_type when array missing', () => {
    const h = mapHold({ ...holdRow, hold_types: [] });
    expect(h.holdTypes).toEqual(['damage']);
  });
  it('maps nested release when present', () => {
    const h = mapHold({ ...holdRow, releases: [releaseRow] });
    expect(h.release?.id).toBe('r1');
  });
  it('leaves release undefined when releases array is empty', () => {
    const h = mapHold(holdRow);
    expect(h.release).toBeUndefined();
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
