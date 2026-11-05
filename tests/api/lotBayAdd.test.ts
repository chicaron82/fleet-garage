// + Add a car already cleaned (api/_lib/lotBayLogDb.ts addCleaned / undoAdd, migration 165). Aaron, 2026-11-05, on
// break with his partner cleaning solo: *"just a way to add them in if needed is enough"*.
// Ticket: docs/ticket-bay-add-a-car-cleaned.md.
import { describe, it, expect } from 'vitest';
import { addCleaned, BayLogRefusal, undoAdd } from '../../api/_lib/lotBayLogDb';
import { parseLotRequest } from '../../api/_lib/lotRequest';
import { bayLines, type BayLogRow } from '../../src/lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-05T19:24:00.000Z';
const TODAY = '2026-11-05';
const SOON = '2026-11-05T19:24:05.000Z';
const LATE = '2026-11-05T19:25:00.000Z';

function lot(log: Row[] = [], dirties: number | null = 23) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 6, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_standby: [],
    vehicles: [{ id: 'v-503', license_plate: 'LZM503', unit_number: '5421', year: 2026, make: 'Kia', model: 'Seltos', color: 'Blue', odometer: null, odometer_at: null }],
    lot_bay_log: log,
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], added: () => tables.lot_bay_log.find(r => r.added === true) };
}

const inBay: Row = { id: 7, vehicle_id: 'v-111', plate: '0GK487', exit: null, exited_at: null, took_dirty: false, shift_day: TODAY, started_at: '2026-11-05T19:10:00.000Z', redo_of: null };

describe('⭐ a car cleaned while he was off the floor goes on the list', () => {
  it('as a Clean stamped now, marked added, and the count moves like a Clean (+1 clean, −1 dirty)', async () => {
    const l = lot([inBay]);
    const out = await addCleaned(l.db, 'v-503', 'AS', NOW, TODAY);
    expect(l.added()).toMatchObject({ plate: 'LZM503', exit: 'clean', started_at: NOW, exited_at: NOW, added: true, took_dirty: true, shift_day: TODAY });
    expect(out.row).toMatchObject({ plate: 'LZM503', added: true });
    expect(l.bay()).toMatchObject({ cleans: 7, dirties: 22 });
  });

  it('⭐ the car in the bay is untouched: adding works whatever is in it', async () => {
    const l = lot([inBay]);
    await addCleaned(l.db, 'v-503', 'AS', NOW, TODAY);
    expect(l.tables.lot_bay_log.find(r => r.id === 7)).toMatchObject({ exit: null, exited_at: null });
  });

  it('a bumped car added this way counts as redone', async () => {
    const skipped: Row = { id: 3, vehicle_id: 'v-503', plate: 'LZM503', exit: 'skip', exited_at: '2026-11-05T17:00:00.000Z', shift_day: TODAY, started_at: '2026-11-05T16:50:00.000Z', redo_of: null };
    const l = lot([skipped]);
    await addCleaned(l.db, 'v-503', 'AS', NOW, TODAY);
    expect(l.added()).toMatchObject({ redo_of: 3 });
  });

  it('⚠️ the car that is IN the bay is refused, and the count stays as it was', async () => {
    const l = lot([{ ...inBay, vehicle_id: 'v-503', plate: 'LZM503' }]);
    await expect(addCleaned(l.db, 'v-503', 'AS', NOW, TODAY)).rejects.toThrow(/in the bay now/);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
    expect(l.added()).toBeUndefined();
  });

  it('a car FG does not have is refused, and nothing moves', async () => {
    const l = lot();
    await expect(addCleaned(l.db, 'v-nope', 'AS', NOW, TODAY)).rejects.toThrow(BayLogRefusal);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
  });
});

describe('its Undo', () => {
  it('takes the row off the list and gives the count back', async () => {
    const l = lot([inBay]);
    const { row } = await addCleaned(l.db, 'v-503', 'AS', NOW, TODAY);
    const out = await undoAdd(l.db, (row as { id: number }).id, 'AS', SOON, TODAY);
    expect(out.removedId).toBe((row as { id: number }).id);
    expect(l.added()).toBeUndefined();
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
  });

  it('⚠️ never removes a car that went through the bay, even inside the window', async () => {
    const real: Row = { id: 9, vehicle_id: 'v-503', plate: 'LZM503', exit: 'clean', exited_at: NOW, took_dirty: true, added: false, shift_day: TODAY, started_at: '2026-11-05T19:10:00.000Z' };
    const l = lot([real]);
    await expect(undoAdd(l.db, 9, 'AS', SOON, TODAY)).rejects.toThrow(/Too late/);
    expect(l.tables.lot_bay_log).toHaveLength(1);
    expect(l.bay()).toMatchObject({ cleans: 6 });
  });

  it('is refused once the window has passed', async () => {
    const l = lot();
    const { row } = await addCleaned(l.db, 'v-503', 'AS', NOW, TODAY);
    await expect(undoAdd(l.db, (row as { id: number }).id, 'AS', LATE, TODAY)).rejects.toThrow(/Too late/);
    expect(l.added()).toBeDefined();
  });
});

describe('the request and the list', () => {
  it('⭐ both actions reach the server (the 11-03 "Unknown action." lesson)', () => {
    expect(parseLotRequest({ action: 'bayAdd', vehicleId: 'v-503', by: 'AS' })).toEqual({ action: 'bayAdd', vehicleId: 'v-503', by: 'AS' });
    expect(parseLotRequest({ action: 'bayAddUndo', id: 12, by: 'AS' })).toEqual({ action: 'bayAddUndo', id: 12, by: 'AS' });
    expect(parseLotRequest({ action: 'bayAdd', by: 'AS' })).toEqual({ error: 'Pick the car first.' });
  });

  it('an added line says "added later", so its time is never read as when it was washed', () => {
    const base = { vehicle_id: 'v', unit_number: null, car: null, odometer: null, took_dirty: false, shift_day: TODAY, note: null, hold_id: null };
    const rows: BayLogRow[] = [
      { ...base, id: 1, plate: 'AAA111', started_at: '2026-11-05T19:00:00Z', exit: 'clean', exited_at: '2026-11-05T19:05:00Z', redo_of: null },
      { ...base, id: 2, plate: 'LZM503', started_at: NOW, exit: 'clean', exited_at: NOW, redo_of: null, added: true },
      { ...base, id: 3, plate: 'BBB222', started_at: '2026-11-05T18:00:00Z', exit: 'skip', exited_at: '2026-11-05T18:01:00Z', redo_of: null },
      { ...base, id: 4, plate: 'BBB222', started_at: LATE, exit: 'clean', exited_at: LATE, redo_of: 3, added: true },
    ];
    const byId = new Map(bayLines(rows).map(l => [l.id, l]));
    expect(byId.get(1)).toMatchObject({ label: 'Clean', note: '' });
    expect(byId.get(2)).toMatchObject({ label: 'Clean', note: 'added later' });
    expect(byId.get(4)).toMatchObject({ label: 'Clean', note: 'added later · was bumped' });
  });
});
