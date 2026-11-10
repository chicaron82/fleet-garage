// ✈ Send all up (api/_lib/lotBayLogChange.ts sendAllUp / undoSendAll). Aaron, 2026-11-10: *"Since we're pretty much
// sending everything up . A "send all" to mark whatever isn't already sent as sent. Not including vehicles held"*.
// docs/ticket-bay-total-and-send-all-up.md
import { describe, it, expect } from 'vitest';
import { sendAllUp, undoSendAll } from '../../api/_lib/lotBayLogChange';
import { BayLogRefusal } from '../../api/_lib/lotBayLogDb';
import { parseBayLog } from '../../api/_lib/lotBayLog';
import { fakeDb, type Row } from './_fakeLotDb';

const TODAY = '2026-11-10';
const line = (id: number, exit: string | null, over: Row = {}): Row => ({
  id, vehicle_id: `v${id}`, plate: `P${id}`, exit, exited_at: exit ? '2026-11-10T17:00:00.000Z' : null, shift_day: TODAY,
  took_dirty: true, sent_up: false, sent_at_exit: false, ...over,
});

function lot(log: Row[]) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 0, dirties: 0, used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_log: log,
  };
  return { tables, db: fakeDb(tables), row: (id: number) => tables.lot_bay_log.find(r => r.id === id)! };
}

describe('⭐ sendAllUp: today\'s unsent Cleans, and nothing else', () => {
  it('marks the Cleans; Erin, M, B, the car in the bay and yesterday\'s Clean stay as they are', async () => {
    const l = lot([
      line(1, 'clean'), line(2, 'clean'), line(3, 'erin'), line(4, 'mhold'), line(5, 'bhold'), line(6, null),
      line(7, 'clean', { shift_day: '2026-11-09' }), line(8, 'clean', { sent_up: true }),
    ]);
    const out = await sendAllUp(l.db, TODAY);
    expect(out.rows.map(r => r.id).sort()).toEqual([1, 2]);
    expect([1, 2, 8].map(id => l.row(id).sent_up)).toEqual([true, true, true]);
    expect([3, 4, 5, 6, 7].map(id => l.row(id).sent_up)).toEqual([false, false, false, false, false]);
  });

  it('moves no count: it is a mark', async () => {
    const l = lot([line(1, 'clean')]);
    await sendAllUp(l.db, TODAY);
    expect(l.tables.lot_bay[0]).toMatchObject({ cleans: 0, dirties: 0 });
    expect(l.tables.lot_bay_taps).toEqual([]);
  });

  it('nothing left to send says so', async () => {
    const l = lot([line(1, 'clean', { sent_up: true }), line(2, 'erin')]);
    await expect(sendAllUp(l.db, TODAY)).rejects.toThrow(BayLogRefusal);
  });
});

describe('⭐ undoSendAll: only the lines Send all marked', () => {
  it('unmarks its ids; a line he marked by hand before stays marked', async () => {
    const l = lot([line(1, 'clean'), line(2, 'clean'), line(8, 'clean', { sent_up: true })]);
    const { rows } = await sendAllUp(l.db, TODAY);
    await undoSendAll(l.db, rows.map(r => r.id as number), TODAY);
    expect([1, 2].map(id => l.row(id).sent_up)).toEqual([false, false]);
    expect(l.row(8).sent_up).toBe(true);
  });

  it('never unmarks a Clean that left the bay sent up (migration 169)', async () => {
    const l = lot([line(9, 'clean', { sent_up: true, sent_at_exit: true })]);
    await undoSendAll(l.db, [9], TODAY);
    expect(l.row(9).sent_up).toBe(true);
  });

  it('parse: ids are row ids, some, not too many', () => {
    expect(parseBayLog({ action: 'baySendAllUp' }, 'AS')).toEqual({ action: 'baySendAllUp', by: 'AS' });
    expect(parseBayLog({ action: 'baySendAllUndo', ids: [1, 2] }, 'AS')).toEqual({ action: 'baySendAllUndo', ids: [1, 2], by: 'AS' });
    expect(parseBayLog({ action: 'baySendAllUndo', ids: [] }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'baySendAllUndo', ids: [1, 'x'] }, 'AS')).toHaveProperty('error');
    expect(parseBayLog({ action: 'baySendAllUndo' }, 'AS')).toHaveProperty('error');
  });
});
