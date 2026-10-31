import { describe, it, expect } from 'vitest';
import { parseBayLog, carLine, undoAllowed, redoOf, startOdometer, EXIT_UNDO_MS, type DayRow } from '../../api/_lib/lotBayLog';

describe('parseBayLog', () => {
  it('a Start names the car', () => {
    expect(parseBayLog({ action: 'bayStart', vehicleId: 'abc-123' }, 'AS')).toEqual({ action: 'bayStart', vehicleId: 'abc-123', by: 'AS' });
    for (const vehicleId of [undefined, '', 12, 'a b', "x'; drop"]) expect(parseBayLog({ action: 'bayStart', vehicleId }, 'AS')).toHaveProperty('error');
  });
  it('an exit is one of his four: clean, mhold, bhold, skip', () => {
    for (const exit of ['clean', 'mhold', 'bhold', 'skip']) {
      expect(parseBayLog({ action: 'bayExit', id: 4, exit }, 'AS')).toEqual({ action: 'bayExit', id: 4, exit, by: 'AS' });
    }
    expect(parseBayLog({ action: 'bayExit', id: 4, exit: 'detail' }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'bayExit', id: 0, exit: 'clean' }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'bayExit', id: '4', exit: 'clean' }, 'AS')).toHaveProperty('error');
  });
  it('an Undo names the row', () => {
    expect(parseBayLog({ action: 'bayExitUndo', id: 9 }, 'AS')).toEqual({ action: 'bayExitUndo', id: 9, by: 'AS' });
    expect(parseBayLog({ action: 'bayExitUndo' }, 'AS')).toHaveProperty('error');
  });
});

describe('carLine', () => {
  it('reads the way the card does: year make model · colour', () => {
    expect(carLine({ year: 2026, make: 'Toyota', model: 'Corolla Cross', color: 'Gray' })).toBe('2026 Toyota Corolla Cross · Gray');
  });
  it('drops what the record does not have, never prints "null"', () => {
    expect(carLine({ year: null, make: 'Kia', model: 'Seltos', color: null })).toBe('Kia Seltos');
    expect(carLine({ color: 'Blue' })).toBe('Blue');
    expect(carLine({})).toBe('');
  });
});

describe('undoAllowed', () => {
  const at = '2026-10-29T17:00:00.000Z';
  const t = Date.parse(at);
  it('inside the window yes, after it no', () => {
    expect(undoAllowed(at, t + 5_000)).toBe(true);
    expect(undoAllowed(at, t + EXIT_UNDO_MS)).toBe(true);
    expect(undoAllowed(at, t + EXIT_UNDO_MS + 1)).toBe(false);
  });
  it('⚠️ a car still in the bay has no exit to take back', () => {
    expect(undoAllowed(null, t)).toBe(false);
  });
});

describe('redoOf: a restart of a skipped car points back at the skip', () => {
  const row = (id: number, vehicle_id: string, exit: DayRow['exit'], started_at: string, redo_of: number | null = null): DayRow =>
    ({ id, vehicle_id, exit, started_at, redo_of });
  it('finds today\'s skip of this car', () => {
    expect(redoOf([row(1, 'A', 'clean', '07:00'), row(2, 'B', 'skip', '09:48')], 'B')).toBe(2);
  });
  it('a car never skipped is a plain start', () => {
    expect(redoOf([row(1, 'A', 'skip', '07:00')], 'B')).toBeNull();
    expect(redoOf([row(1, 'B', 'clean', '07:00')], 'B')).toBeNull();
  });
  it('⚠️ a skip already redone is not redone twice', () => {
    expect(redoOf([row(2, 'B', 'skip', '09:48'), row(3, 'B', 'clean', '10:20', 2)], 'B')).toBeNull();
  });
  it('skipped twice: the latest open skip', () => {
    expect(redoOf([row(2, 'B', 'skip', '09:48'), row(3, 'B', 'skip', '10:20', 2), row(4, 'A', 'clean', '10:30')], 'B')).toBe(3);
  });
});

describe('startOdometer: a bay row carries an odo only from today (docs/ticket-bay-log-first-shift-friction.md)', () => {
  // Shift-day 2026-10-30 runs 04:00 Winnipeg on the 30th to 04:00 on the 31st, all of it CDT (UTC−5).
  // ⚠️ Fixtures stay in October on purpose: from 2026-11-01 the answer depends on the runtime's tzdata (2026a still
  // falls back to CST; 2026e keeps UTC−5), and a test must not pass on one Node and fail on another (bc67e515).
  const today = '2026-10-30';
  it('a reading taken this shift-day goes on the row', () => {
    expect(startOdometer({ odometer: 38071, odometer_at: '2026-10-30T13:10:00.000Z' }, today)).toBe(38071);
  });
  it('⚠️ last night\'s reading does not: Start no longer waits on today\'s odo, so the row must not pass it off as today\'s', () => {
    expect(startOdometer({ odometer: 38071, odometer_at: '2026-10-30T03:00:00.000Z' }, today)).toBeNull();   // 22:00 on the 29th
    expect(startOdometer({ odometer: 38071, odometer_at: '2026-10-24T15:00:00.000Z' }, today)).toBeNull();
  });
  it('the 04:00 cutover decides, not midnight', () => {
    expect(startOdometer({ odometer: 5, odometer_at: '2026-10-30T08:59:00.000Z' }, today)).toBeNull();      // 03:59, still the 29th
    expect(startOdometer({ odometer: 5, odometer_at: '2026-10-30T09:00:00.000Z' }, today)).toBe(5);         // 04:00, the 30th
    expect(startOdometer({ odometer: 5, odometer_at: '2026-10-31T08:30:00.000Z' }, today)).toBe(5);         // 03:30 next night, a closer's
  });
  it('no reading, or no time on it, is no odo', () => {
    expect(startOdometer({ odometer: null, odometer_at: '2026-10-30T13:10:00.000Z' }, today)).toBeNull();
    expect(startOdometer({ odometer: 38071, odometer_at: null }, today)).toBeNull();
    expect(startOdometer({ odometer: 38071, odometer_at: 'not a date' }, today)).toBeNull();
    expect(startOdometer({}, today)).toBeNull();
  });
});
