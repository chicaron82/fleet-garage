// The bay's Erin exit, his note on a row, and "Same as the … hold" (migration 164; docs/ticket-bay-erin-exit-notes-
// existing-hold.md). Aaron, 2026-11-04: *"Erin. Since cleaning them goes to their row to be rented at Erin St and not going
// up for the airport"*, ruled it *"takes one off the dirties"*; notes *"can be seen via the read-only link"*; and an M / B
// row whose car is already held may be tied to that hold from the list.
import { describe, it, expect } from 'vitest';
import { exitCar, linkHold, setNote, undoExit } from '../../api/_lib/lotBayLogDb';
import { cleanNote, holdFitsExit, isNoteRefusal, linkRefusal, parseBayLog, NOTE_MAX } from '../../api/_lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-04T17:06:00.000Z';
const TODAY = '2026-11-04';
const AFTER = '2026-11-04T17:06:05.000Z';

function lot(dirties: number | null, logOver: Row = {}, holds: Row[] = []) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 6, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_standby: [],
    lot_bay_log: [{ id: 7, vehicle_id: 'v1', plate: 'LZM503', exit: null, exited_at: null, took_dirty: false, note: null, hold_id: null, ...logOver }],
    holds,
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], log: () => tables.lot_bay_log[0] };
}

describe('⭐ 🏠 Erin: off the dirties, never onto the cleans', () => {
  it('dirties −1, cleans untouched, its own line on Today\'s list, and the row remembers the take', async () => {
    const l = lot(9);
    await exitCar(l.db, 7, 'erin', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, cleans_at: 'x', dirties: 8, dirties_at: NOW });
    expect(l.log()).toMatchObject({ exit: 'erin', exited_at: NOW, took_dirty: true });
    expect(l.tables.lot_bay_taps).toEqual([{ kind: 'erin', value: 8, prev: 9, tapped_by: 'AS' }]);
  });

  it('a Clean, beside it, is still +1 on the cleans (the difference is the whole point)', async () => {
    const l = lot(9);
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 7 });
  });

  it('dirties at 0: the car still leaves as Erin, nothing taken, nothing logged', async () => {
    const l = lot(0);
    await exitCar(l.db, 7, 'erin', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 0 });
    expect(l.log()).toMatchObject({ exit: 'erin', took_dirty: false });
    expect(l.tables.lot_bay_taps).toEqual([]);
  });

  it('⭐ Undo gives the dirty back and leaves the cleans alone', async () => {
    const l = lot(9);
    await exitCar(l.db, 7, 'erin', 'AS', NOW, TODAY);
    await undoExit(l.db, 7, 'AS', AFTER, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 9 });
    expect(l.log()).toMatchObject({ exit: null, took_dirty: false });
  });

  it('parse: erin is an exit', () => {
    expect(parseBayLog({ action: 'bayExit', id: 7, exit: 'erin' }, 'AS')).toEqual({ action: 'bayExit', id: 7, exit: 'erin', by: 'AS' });
  });
});

describe('📝 his note on a row', () => {
  it('⭐ saves on a finished row, and clears with null', async () => {
    const l = lot(9, { exit: 'clean', exited_at: NOW });
    await setNote(l.db, 7, 'keys in the cupholder');
    expect(l.log()).toMatchObject({ note: 'keys in the cupholder' });
    await setNote(l.db, 7, null);
    expect(l.log()).toMatchObject({ note: null });
  });

  it('refuses the car still in the bay: it has no line yet', async () => {
    const l = lot(9);
    await expect(setNote(l.db, 7, 'x')).rejects.toThrow('not on the list yet');
    expect(l.log()).toMatchObject({ note: null });
  });

  it('one line, trimmed; blank is no note; too long is refused, never cut', () => {
    expect(cleanNote('  rear  wiper\n loose ')).toBe('rear wiper loose');
    expect(cleanNote('   ')).toBeNull();
    expect(cleanNote(null)).toBeNull();
    expect(cleanNote('x'.repeat(NOTE_MAX))).toBe('x'.repeat(NOTE_MAX));
    expect(cleanNote('x'.repeat(NOTE_MAX + 1))).toEqual({ error: `Keep the note to ${NOTE_MAX} characters.` });
    expect(parseBayLog({ action: 'bayNote', id: 7, note: 'x'.repeat(NOTE_MAX + 1) }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'bayNote', id: 7, note: ' ok ' }, 'AS')).toEqual({ action: 'bayNote', id: 7, note: 'ok', by: 'AS' });
  });

  it('a refusal is the object, never a blank note (null is typeof "object" too)', () => {
    expect(isNoteRefusal({ error: 'x' })).toBe(true);
    expect(isNoteRefusal(null)).toBe(false);
    expect(isNoteRefusal('ok')).toBe(false);
    expect(parseBayLog({ action: 'bayNote', id: 7, note: '   ' }, 'AS')).toEqual({ action: 'bayNote', id: 7, note: null, by: 'AS' });
  });
});

describe('⭐ "Same as the … hold": the row tied to the hold already on the car', () => {
  const held = (over: Row = {}) => ({ id: 'h1', vehicle_id: 'v1', status: 'ACTIVE', hold_types: ['damage'], ...over });

  it('a B row takes the car\'s ACTIVE damage hold', async () => {
    const l = lot(9, { exit: 'bhold', exited_at: NOW }, [held()]);
    await linkHold(l.db, 7, 'h1');
    expect(l.log()).toMatchObject({ hold_id: 'h1' });
  });

  it('an M row takes a mechanical one; hail counts as damage for B', () => {
    expect(holdFitsExit('mhold', ['mechanical'])).toBe(true);
    expect(holdFitsExit('bhold', ['hail'])).toBe(true);
    expect(holdFitsExit('mhold', ['damage'])).toBe(false);
    expect(holdFitsExit('bhold', ['mechanical'])).toBe(false);
    expect(holdFitsExit('clean', ['damage'])).toBe(false);
  });

  it('⭐ refuses another car\'s hold, a closed hold, the wrong kind, and a row that is not M / B', async () => {
    const cases: [Row, Row, string][] = [
      [{ exit: 'bhold' }, held({ vehicle_id: 'v2' }), 'not on this car'],
      [{ exit: 'bhold' }, held({ status: 'RELEASED' }), 'closed now'],
      [{ exit: 'mhold' }, held(), 'not mechanical'],
      [{ exit: 'clean' }, held(), 'Only an M hold or B hold'],
    ];
    for (const [rowOver, hold, said] of cases) {
      const l = lot(9, { exited_at: NOW, ...rowOver }, [hold]);
      await expect(linkHold(l.db, 7, 'h1')).rejects.toThrow(said);
      expect(l.log()).toMatchObject({ hold_id: null });
    }
  });

  it('refuses a hold that is not there', () => {
    expect(linkRefusal({ vehicle_id: 'v1', exit: 'bhold' }, null)).toBe('That hold is not on this car.');
  });

  it('Undo clears the tie: the car is back in, and its next exit may be another kind', async () => {
    const l = lot(9, { exit: 'bhold', exited_at: NOW, took_dirty: false }, [held()]);
    await linkHold(l.db, 7, 'h1');
    await undoExit(l.db, 7, 'AS', AFTER, TODAY);
    expect(l.log()).toMatchObject({ exit: null, hold_id: null });
  });
});
