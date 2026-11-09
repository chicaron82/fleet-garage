// A trip to the airport marks today's Clean ✈ (api/_lib/lotBayLogChange.ts sentUpByTrip). Aaron, 2026-11-09: *"if I make
// a trip to the airport and it's a car that was cleaned today, it changes it to sent up and minus 1 from the cleans"*.
// Ticket: docs/ticket-trip-marks-sent-up.md. The −1 is the trip's own call (lotBayTripClean.test.ts); this moves no count.
import { describe, it, expect } from 'vitest';
import { sentUpByTrip } from '../../api/_lib/lotBayLogChange';
import { parseBayLog, tripPlate } from '../../api/_lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const TODAY = '2026-11-09';
const line = (id: number, exit: string | null, at: string | null, extra: Row = {}): Row => ({
  id, vehicle_id: `v${id}`, plate: 'LUR437', exit, exited_at: at, took_dirty: false, shift_day: TODAY,
  started_at: at, redo_of: null, hold_id: null, was_exit: null, sent_up: false, ...extra,
});
function lot(log: Row[]) {
  const tables: Record<string, Row[]> = { lot_bay: [{ id: 1, cleans: 4, dirties: 2, used: 0, used_on: TODAY }], lot_bay_log: log };
  return { db: fakeDb(tables), row: (id: number) => tables.lot_bay_log.find(r => r.id === id)!, bay: () => tables.lot_bay[0] };
}

describe('tripPlate: as the log writes it', () => {
  it('uppercases and drops the space a trip types ("KUR 261")', () => {
    expect(tripPlate('kur 261')).toBe('KUR261');
    expect(tripPlate(' LUR-437 ')).toBe('LUR437');
  });
  it('an empty or junk plate is none', () => {
    expect(tripPlate('')).toBeNull();
    expect(tripPlate('  ')).toBeNull();
    expect(tripPlate(437)).toBeNull();
  });
  it('the parser takes it, and refuses a trip with no plate', () => {
    expect(parseBayLog({ action: 'bayTripSentUp', plate: 'lur 437' }, 'AS')).toEqual({ action: 'bayTripSentUp', plate: 'LUR437', by: 'AS' });
    expect(parseBayLog({ action: 'bayTripSentUp', plate: '' }, 'AS')).toHaveProperty('error');
  });
});

describe('⭐ sentUpByTrip', () => {
  it('marks today\'s Clean for the plate, and moves no count', async () => {
    const l = lot([line(5, 'clean', '2026-11-09T18:56:00.000Z')]);
    const out = await sentUpByTrip(l.db, 'LUR437', TODAY);
    expect(out.row).toMatchObject({ id: 5, sent_up: true });
    expect(l.row(5).sent_up).toBe(true);
    expect(l.bay()).toMatchObject({ cleans: 4, dirties: 2 });
  });
  it('⭐ the plate\'s NEWEST line decides: a redo that came out Erin is not marked through its old Clean', async () => {
    const l = lot([line(5, 'clean', '2026-11-09T18:56:00.000Z'), line(6, 'erin', '2026-11-09T20:10:00.000Z')]);
    expect((await sentUpByTrip(l.db, 'LUR437', TODAY)).row).toBeNull();
    expect(l.row(5).sent_up).toBe(false);
  });
  it('⭐ an earlier day\'s Clean is not today\'s', async () => {
    const l = lot([line(5, 'clean', '2026-11-08T18:56:00.000Z', { shift_day: '2026-11-08' })]);
    expect((await sentUpByTrip(l.db, 'LUR437', TODAY)).row).toBeNull();
    expect(l.row(5).sent_up).toBe(false);
  });
  it('⭐ one he already marked by hand comes back null, so the trip\'s Reset never takes his ✈ off', async () => {
    const l = lot([line(5, 'clean', '2026-11-09T18:56:00.000Z', { sent_up: true })]);
    expect((await sentUpByTrip(l.db, 'LUR437', TODAY)).row).toBeNull();
    expect(l.row(5).sent_up).toBe(true);
  });
  it('quiet for an Erin / M / B line, a car still in the bay, and a car not on the list', async () => {
    for (const exit of ['erin', 'mhold', 'bhold']) {
      const l = lot([line(5, exit, '2026-11-09T18:56:00.000Z')]);
      expect((await sentUpByTrip(l.db, 'LUR437', TODAY)).row).toBeNull();
      expect(l.row(5).sent_up).toBe(false);
    }
    const inBay = lot([line(5, null, null)]);
    expect((await sentUpByTrip(inBay.db, 'LUR437', TODAY)).row).toBeNull();
    expect((await sentUpByTrip(lot([]).db, 'LUR437', TODAY)).row).toBeNull();
  });
});
