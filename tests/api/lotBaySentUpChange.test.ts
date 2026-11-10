// ✈ Sent up, and Change a finished line's exit (migration 167, api/_lib/lotBayLogChange.ts). Aaron, 2026-11-09:
// *"Editing a cleaned vehicle to M, B, or Erin afterwards"*, and *"FG doesn't need to know about an ASAP vehicle. Just
// that something we cleaned was sent up right away and marking it as such"*. LUR437, the Durango that started it, came
// out Clean at 13:56 and went straight back up. Ticket: docs/ticket-bay-sent-up-and-change-exit.md.
import { describe, it, expect } from 'vitest';
import { changeExit, setSentUp } from '../../api/_lib/lotBayLogChange';
import { BayLogRefusal, undoExit } from '../../api/_lib/lotBayLogDb';
import { changeExitPlan, nextWasExit, parseBayLog } from '../../api/_lib/lotBayLog';
import { changedExitCount } from '../../api/_lib/lotBay';
import { bayLines, type BayLogRow } from '../../src/lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-09T20:10:00.000Z';
const TODAY = '2026-11-09';
const OUT = '2026-11-09T18:56:00.000Z';

function lot(log: Row[], taps: Row[] = [], cleans = 7, dirties = 3) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: taps,
    lot_bay_standby: [],
    lot_bay_log: log,
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], row: (id: number) => tables.lot_bay_log.find(r => r.id === id)! };
}
const finished = (id: number, exit: string, extra: Row = {}): Row => ({
  id, vehicle_id: `v${id}`, plate: 'LUR437', exit, exited_at: OUT, took_dirty: true, shift_day: TODAY, started_at: OUT,
  redo_of: null, pulled_by: null, hold_id: null, was_exit: null, sent_up: false, sent_at_exit: false, ...extra,
});

describe('changeExitPlan: only the cleans move, and only across Clean', () => {
  const none = { cleansSet: false };
  it('⭐ off a Clean −1, onto a Clean +1', () => {
    for (const to of ['erin', 'mhold', 'bhold'] as const) {
      expect(changeExitPlan('clean', to, none)).toBe(-1);
      expect(changeExitPlan(to, 'clean', none)).toBe(1);
    }
  });
  it('between Erin, M and B nothing moves: the same dirty off, no clean', () => {
    expect(changeExitPlan('erin', 'mhold', none)).toBe(0);
    expect(changeExitPlan('mhold', 'bhold', none)).toBe(0);
  });
  it('⭐ a cleans count he set by hand since the exit is his', () => {
    expect(changeExitPlan('clean', 'bhold', { cleansSet: true })).toBe(0);
    expect(changeExitPlan('mhold', 'clean', { cleansSet: true })).toBe(0);
  });
});

describe('nextWasExit: the first exit, until it lands back there', () => {
  it('remembers the FIRST exit across two changes, and clears on a return', () => {
    expect(nextWasExit(null, 'clean', 'mhold')).toBe('clean');
    expect(nextWasExit('clean', 'mhold', 'bhold')).toBe('clean');
    expect(nextWasExit('clean', 'bhold', 'clean')).toBeNull();
  });
});

describe('changedExitCount: never the dirties', () => {
  const row = { cleans: 7, dirties: 3, used: 0, used_on: null };
  it('+1 adds a clean and takes NO dirty (the first exit already did)', () => {
    expect(changedExitCount(row, 1, 'AS', NOW)!.patch).toEqual({ cleans: 8, cleans_by: 'AS', cleans_at: NOW });
  });
  it('−1 is a fix, never "used"; at 0 it stays as the lot is', () => {
    const c = changedExitCount(row, -1, 'AS', NOW)!;
    expect(c.patch).toEqual({ cleans: 6, cleans_by: 'AS', cleans_at: NOW });
    expect(c.tap.kind).toBe('fix');
    expect(changedExitCount({ ...row, cleans: 0 }, -1, 'AS', NOW)).toBeNull();
  });
});

describe('parseBayLog', () => {
  it('takes both, and refuses Skip as a change', () => {
    expect(parseBayLog({ action: 'bayChangeExit', id: 5, exit: 'bhold' }, 'AS')).toEqual({ action: 'bayChangeExit', id: 5, exit: 'bhold', by: 'AS' });
    expect(parseBayLog({ action: 'bayChangeExit', id: 5, exit: 'skip' }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'baySentUp', id: 5, sent: true }, 'AS')).toEqual({ action: 'baySentUp', id: 5, sent: true, by: 'AS' });
    expect(parseBayLog({ action: 'baySentUp', id: 5, sent: 'yes' }, 'AS')).toHaveProperty('error');
  });
});

describe('⭐ changeExit', () => {
  it('Clean → B: cleans 7 → 6, the dirties stay, "was Clean", and ✈ sent up goes', async () => {
    const l = lot([finished(5, 'clean', { sent_up: true })]);
    await changeExit(l.db, 5, 'bhold', 'AS', NOW, TODAY);
    expect(l.row(5)).toMatchObject({ exit: 'bhold', was_exit: 'clean', sent_up: false, exited_at: OUT, hold_id: null });
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 3 });
  });
  it('M → Clean: cleans 7 → 8, no dirty taken', async () => {
    const l = lot([finished(5, 'mhold', { hold_id: 'h1' })]);
    await changeExit(l.db, 5, 'clean', 'AS', NOW, TODAY);
    expect(l.row(5)).toMatchObject({ exit: 'clean', was_exit: 'mhold', hold_id: null });
    expect(l.bay()).toMatchObject({ cleans: 8, dirties: 3 });
  });
  it('Erin → M moves no count', async () => {
    const l = lot([finished(5, 'erin')]);
    await changeExit(l.db, 5, 'mhold', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 7, dirties: 3 });
  });
  it('⭐ a cleans SET since the exit: the line changes, the count stays his', async () => {
    const l = lot([finished(5, 'clean')], [{ kind: 'set', tapped_at: '2026-11-09T19:30:00.000Z' }]);
    await changeExit(l.db, 5, 'erin', 'AS', NOW, TODAY);
    expect(l.row(5).exit).toBe('erin');
    expect(l.bay().cleans).toBe(7);
  });
  it('refuses a Bumped line, an earlier day, the same exit, and a car still in the bay, moving nothing', async () => {
    const cases: [Row, string][] = [
      [finished(5, 'skip'), 'bumped'],
      [finished(5, 'clean', { shift_day: '2026-11-08' }), 'today'],
      [finished(5, 'bhold'), 'already'],
      [finished(5, null as unknown as string, { exited_at: null }), 'still in the bay'],
    ];
    for (const [r, says] of cases) {
      const l = lot([r]);
      await expect(changeExit(l.db, 5, 'bhold', 'AS', NOW, TODAY)).rejects.toThrow(BayLogRefusal);
      await expect(changeExit(l.db, 5, 'bhold', 'AS', NOW, TODAY)).rejects.toThrow(says);
      expect(l.bay()).toMatchObject({ cleans: 7, dirties: 3 });
    }
  });
});

describe('⭐ setSentUp', () => {
  it('marks a Clean and takes it back, moving no count', async () => {
    const l = lot([finished(5, 'clean')]);
    await setSentUp(l.db, 5, true);
    expect(l.row(5).sent_up).toBe(true);
    await setSentUp(l.db, 5, false);
    expect(l.row(5).sent_up).toBe(false);
    expect(l.bay()).toMatchObject({ cleans: 7, dirties: 3 });
  });
  it('refuses anything but a Clean', async () => {
    const l = lot([finished(5, 'erin')]);
    await expect(setSentUp(l.db, 5, true)).rejects.toThrow('Only a Clean');
    expect(l.row(5).sent_up).toBe(false);
  });
});

describe('an exit\'s Undo clears both: the car is back in the bay', () => {
  it('was_exit and sent_up go with the exit', async () => {
    const at = '2026-11-09T20:09:55.000Z';
    const l = lot([finished(5, 'clean', { exited_at: at, sent_up: true, was_exit: 'bhold' })]);
    await undoExit(l.db, 5, 'AS', NOW, TODAY);
    expect(l.row(5)).toMatchObject({ exit: null, was_exit: null, sent_up: false });
  });
});

describe('bayLines: what the list says', () => {
  const r = (over: Partial<BayLogRow>): BayLogRow => ({
    id: 5, vehicle_id: 'v5', plate: 'LUR437', unit_number: null, car: null, odometer: null, started_at: OUT, exit: 'clean',
    exited_at: OUT, took_dirty: true, redo_of: null, shift_day: TODAY, note: null, hold_id: null, ...over,
  });
  it('⭐ ✈ on a Clean, and "was" on a changed line', () => {
    expect(bayLines([r({ sent_up: true })])[0]).toMatchObject({ sentUp: true, was: '' });
    expect(bayLines([r({ exit: 'bhold', was_exit: 'clean' })])[0]).toMatchObject({ sentUp: false, was: 'Clean' });
  });
  it('a sent_up left on a non-Clean never shows', () => {
    expect(bayLines([r({ exit: 'erin', sent_up: true })])[0]!.sentUp).toBe(false);
  });
});
