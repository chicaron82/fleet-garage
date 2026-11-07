// His delete (api/_lib/lotBayLogDb.ts removeRow, api/_lib/lotBayLog.ts removeCountPlan). Aaron, 2026-11-06, mid-close:
// *"We need a delete option for me. Cook tonight. But for now can you delete the duplicate LUR322"*. That day LUR322
// went through twice and LUR367 got a Clean after its B; both came off by hand. Ticket: docs/ticket-bay-remove-a-row.md.
import { describe, it, expect } from 'vitest';
import { BayLogRefusal, removeRow } from '../../api/_lib/lotBayLogDb';
import { parseBayLog, removeCountPlan } from '../../api/_lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-07T03:30:00.000Z';
const TODAY = '2026-11-06';

function lot(log: Row[], taps: Row[] = [], cleans = 16, dirties = 4) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 14, used_on: TODAY }],
    lot_bay_taps: taps,
    lot_bay_standby: [],
    lot_bay_log: log,
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], ids: () => tables.lot_bay_log.map(r => r.id) };
}
const finished = (id: number, plate: string, exit: string, exitedAt: string, extra: Row = {}): Row =>
  ({ id, vehicle_id: `v-${plate}`, plate, exit, exited_at: exitedAt, took_dirty: true, shift_day: TODAY, started_at: exitedAt, redo_of: null, pulled_by: null, ...extra });

describe('removeCountPlan: the count goes back the way the exit moved it', () => {
  const none = { cleansSet: false, dirtiesSet: false };
  it('⭐ a Clean: its +1 comes off and its dirty comes back', () => {
    expect(removeCountPlan({ exit: 'clean', took_dirty: true }, none)).toEqual({ cleans: -1, giveDirty: true });
  });
  it('M, B and Erin: only the dirty they took', () => {
    for (const exit of ['mhold', 'bhold', 'erin'] as const) expect(removeCountPlan({ exit, took_dirty: true }, none)).toEqual({ cleans: 0, giveDirty: true });
    expect(removeCountPlan({ exit: 'bhold', took_dirty: false }, none)).toEqual({ cleans: 0, giveDirty: false });
  });
  it('a Skip moved nothing', () => {
    expect(removeCountPlan({ exit: 'skip', took_dirty: true }, none)).toEqual({ cleans: 0, giveDirty: false });
  });
  it('⭐ a count he set by hand since the exit is his: LUR367\'s dirty stays where his 16:45 recount put it', () => {
    expect(removeCountPlan({ exit: 'clean', took_dirty: true }, { cleansSet: false, dirtiesSet: true })).toEqual({ cleans: -1, giveDirty: false });
    expect(removeCountPlan({ exit: 'clean', took_dirty: true }, { cleansSet: true, dirtiesSet: false })).toEqual({ cleans: 0, giveDirty: true });
  });
  it('parses', () => {
    expect(parseBayLog({ action: 'bayRemove', id: 292 }, 'AS')).toEqual({ action: 'bayRemove', id: 292, by: 'AS' });
    expect(parseBayLog({ action: 'bayRemove' }, 'AS')).toHaveProperty('error');
  });
});

describe('⭐ removeRow: a finished car comes off today\'s list', () => {
  it('LUR367\'s stray Clean: the row goes, cleans 16 → 15, and its dirty stays put after his recount', async () => {
    const l = lot([finished(290, 'LUR367', 'bhold', '2026-11-06T21:22:22.905Z'), finished(292, 'LUR367', 'clean', '2026-11-06T21:40:34.090Z')],
      [{ kind: 'ready', tapped_at: '2026-11-06T21:40:34.908Z' }, { kind: 'dirties', tapped_at: '2026-11-06T21:45:02.340Z' }]);
    const out = await removeRow(l.db, 292, 'AS', NOW, TODAY);
    expect(out.removedId).toBe(292);
    expect(l.ids()).toEqual([290]);
    expect(l.bay()).toMatchObject({ cleans: 15, dirties: 4, used: 14 });
  });

  it('with no hand count since, a Clean gives its dirty back too', async () => {
    const l = lot([finished(275, 'LUR322', 'clean', '2026-11-06T19:45:39.596Z')]);
    await removeRow(l.db, 275, 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 15, dirties: 5 });
  });

  it('a B hold gives back only its dirty', async () => {
    const l = lot([finished(290, 'LUR367', 'bhold', '2026-11-06T21:22:22.905Z')]);
    await removeRow(l.db, 290, 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 16, dirties: 5 });
  });

  it('⭐ the car it pulled in keeps its line: the link is cleared, never the row', async () => {
    const l = lot([finished(273, 'LUR344', 'clean', '2026-11-06T19:39:37.407Z'), finished(274, 'LUR322', 'clean', '2026-11-06T19:40:17.796Z', { pulled_by: 273 })]);
    await removeRow(l.db, 273, 'AS', NOW, TODAY);
    expect(l.tables.lot_bay_log).toEqual([expect.objectContaining({ id: 274, pulled_by: null })]);
  });

  it('⚠️ refused: a car still in the bay, an earlier day, a row already gone. Nothing moves', async () => {
    const l = lot([{ ...finished(9, 'LZM569', 'clean', 'x'), exit: null, exited_at: null }, finished(8, 'LUR185', 'clean', '2026-11-05T21:00:00.000Z', { shift_day: '2026-11-05' })]);
    await expect(removeRow(l.db, 9, 'AS', NOW, TODAY)).rejects.toThrow(/still in the bay/);
    await expect(removeRow(l.db, 8, 'AS', NOW, TODAY)).rejects.toThrow(/Only today/);
    await expect(removeRow(l.db, 77, 'AS', NOW, TODAY)).rejects.toThrow(BayLogRefusal);
    expect(l.ids()).toEqual([9, 8]);
    expect(l.bay()).toMatchObject({ cleans: 16, dirties: 4 });
  });
});
