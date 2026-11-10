// ✈ Clean · sent up (migration 169, docs/ticket-bay-clean-sent-up-at-exit.md). Aaron, 2026-11-10, on shift: *"thoughts on
// having a "clean+sent" we're caught up so drivers take it once it's cleaned. Removes a dirty and doesn't +1 the clean so I
// don't have to -1 when they take it"*. The line has to REMEMBER it never added a clean, or its Undo, Remove and Change
// would take back a clean that was never there.
import { describe, it, expect } from 'vitest';
import { exitCar, removeRow, undoExit } from '../../api/_lib/lotBayLogDb';
import { changeExit, setSentUp } from '../../api/_lib/lotBayLogChange';
import { changeExitPlan, parseBayLog, removeCountPlan } from '../../api/_lib/lotBayLog';
import { bayTapLine } from '../../src/lib/lotBay';
import { bayLines, type BayLogRow } from '../../src/lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-10T16:30:00.000Z';
const SOON = '2026-11-10T16:30:05.000Z';
const LATER = '2026-11-10T16:45:00.000Z';
const TODAY = '2026-11-10';

function lot(dirties: number | null = 9, cleans = 6) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_standby: [],
    lot_bay_log: [{ id: 7, vehicle_id: 'v1', plate: 'A041YN', exit: null, exited_at: null, took_dirty: false, shift_day: TODAY,
      started_at: NOW, redo_of: null, pulled_by: null, note: null, hold_id: null, was_exit: null, sent_up: false, sent_at_exit: false }],
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], log: () => tables.lot_bay_log[0] };
}

describe('⭐ the exit: a dirty off, the cleans untouched, the line a Clean marked ✈', () => {
  it('dirties −1, cleans stay, its own tap, and the row remembers both the take and the send', async () => {
    const l = lot();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, undefined, true, true);
    expect(l.bay()).toMatchObject({ cleans: 6, cleans_at: 'x', dirties: 8, dirties_at: NOW });
    expect(l.log()).toMatchObject({ exit: 'clean', exited_at: NOW, took_dirty: true, sent_up: true, sent_at_exit: true });
    expect(l.tables.lot_bay_taps).toEqual([{ kind: 'sent', value: 8, prev: 9, tapped_by: 'AS' }]);
  });

  it('the control: a plain Clean beside it is still +1 and unmarked', async () => {
    const l = lot();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 7 });
    expect(l.log()).toMatchObject({ sent_up: false, sent_at_exit: false });
  });

  it('dirties at 0: it still leaves sent up, nothing taken', async () => {
    const l = lot(0);
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, undefined, true, true);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 0 });
    expect(l.log()).toMatchObject({ exit: 'clean', took_dirty: false, sent_at_exit: true });
  });
});

/** A line that already LEFT as ✈ Clean · sent up: 9 dirties became 8, the cleans stayed 6. Seeded, not exited, so each
 *  move below is tested on its own (a revert control caught the exit-driven version passing on the old code). */
function sentLine() {
  const l = lot(8);
  Object.assign(l.log(), { exit: 'clean', exited_at: NOW, took_dirty: true, sent_up: true, sent_at_exit: true });
  return l;
}

describe('⭐ every later move takes back only the dirty', () => {
  it('Undo: the dirty back, no clean off, the marks gone', async () => {
    const l = sentLine();
    await undoExit(l.db, 7, 'AS', SOON, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 9 });
    expect(l.log()).toMatchObject({ exit: null, sent_up: false, sent_at_exit: false });
  });

  it('Remove: the dirty back, the cleans untouched', async () => {
    const l = sentLine();
    await removeRow(l.db, 7, 'AS', LATER, TODAY);
    expect(l.tables.lot_bay_log).toEqual([]);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 9 });
  });

  it('Change to B hold: no clean comes off (there never was one), and it is no longer sent', async () => {
    const l = sentLine();
    await changeExit(l.db, 7, 'bhold', 'AS', LATER, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 8 });
    expect(l.log()).toMatchObject({ exit: 'bhold', was_exit: 'clean', sent_up: false, sent_at_exit: false });
  });

  it('the control: a plain Clean changed to B hold still gives its clean back', async () => {
    const l = lot();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    await changeExit(l.db, 7, 'bhold', 'AS', LATER, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6 });
  });

  it('its ✈ cannot be taken off from the list; a hand ✈ on a plain Clean still can', async () => {
    const l = sentLine();
    await expect(setSentUp(l.db, 7, false)).rejects.toThrow('stays sent up');
    expect(l.log()).toMatchObject({ sent_up: true });
    const p = lot();
    await exitCar(p.db, 7, 'clean', 'AS', NOW, TODAY);
    await setSentUp(p.db, 7, true);
    await setSentUp(p.db, 7, false);
    expect(p.log()).toMatchObject({ sent_up: false });
    expect(p.bay()).toMatchObject({ cleans: 7 });
  });
});

describe('the pure rules', () => {
  it('removeCountPlan: a sent Clean gives its dirty back and no clean', () => {
    const none = { cleansSet: false, dirtiesSet: false };
    expect(removeCountPlan({ exit: 'clean', took_dirty: true, sent_at_exit: true }, none)).toEqual({ cleans: 0, giveDirty: true });
    expect(removeCountPlan({ exit: 'clean', took_dirty: true, sent_at_exit: false }, none)).toEqual({ cleans: -1, giveDirty: true });
  });

  it('changeExitPlan: off a sent Clean nothing moves; onto a Clean it is +1 as ever', () => {
    expect(changeExitPlan('clean', 'erin', { cleansSet: false, sentAtExit: true })).toBe(0);
    expect(changeExitPlan('clean', 'erin', { cleansSet: false })).toBe(-1);
    expect(changeExitPlan('erin', 'clean', { cleansSet: false })).toBe(1);
  });

  it('parse: sent rides on a Clean only', () => {
    expect(parseBayLog({ action: 'bayExit', id: 7, exit: 'clean', sent: true }, 'AS')).toEqual({ action: 'bayExit', id: 7, exit: 'clean', by: 'AS', sent: true });
    expect(parseBayLog({ action: 'bayExit', id: 7, exit: 'clean', sent: false }, 'AS')).toEqual({ action: 'bayExit', id: 7, exit: 'clean', by: 'AS' });
    expect(parseBayLog({ action: 'bayExit', id: 7, exit: 'erin', sent: true }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'bayExit', id: 7, exit: 'clean', sent: 'yes' }, 'AS')).toHaveProperty('error');
  });

  it('the list: a Clean ✈ sent at its exit, and the count history names the tap', () => {
    const r = { id: 7, vehicle_id: 'v1', plate: 'A041YN', car: null, odometer: null, started_at: NOW, exit: 'clean', exited_at: NOW,
      took_dirty: true, redo_of: null, shift_day: TODAY, note: null, hold_id: null, sent_up: true, sent_at_exit: true } as BayLogRow;
    expect(bayLines([r])[0]).toMatchObject({ kind: 'clean', sentUp: true, sentAtExit: true });
    expect(bayTapLine({ kind: 'sent', value: 8 })).toBe('Cleaned and sent up, off the dirties · 8 dirties');
  });
});
