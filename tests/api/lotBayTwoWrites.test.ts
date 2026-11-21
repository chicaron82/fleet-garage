// The count and the line are two tables written one after the other (line-check 2026-11-21 #3). When the second write
// fails, the count must not be left one off with "did not save" on his screen: a retry would count the car twice.
// exitCar gives the count back (addCleaned's rule); undoExit and changeExit, whose line already changed, say so in words.
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { exitCar, undoExit, BayLogRefusal } from '../../api/_lib/lotBayLogDb';
import { changeExit } from '../../api/_lib/lotBayLogChange';
import { fakeDb, type Row } from './_fakeLotDb';

const NOW = '2026-11-21T16:30:00.000Z';
const SOON = '2026-11-21T16:30:05.000Z';
const TODAY = '2026-11-21';

/** The fake DB, with one table's UPDATEs failing (a network blip or a database error mid-request). */
function failing(db: SupabaseClient, table: string, fail: () => boolean): SupabaseClient {
  const boom = { data: null, error: { message: 'connection reset', code: 'XX000' } };
  return {
    from: (t: string) => {
      const q = (db as unknown as { from: (t: string) => Record<string, (...a: unknown[]) => unknown> }).from(t);
      if (t !== table) return q;
      const update = q.update;
      q.update = (...a: unknown[]) => {
        if (!fail()) return update(...a);
        const chain: Record<string, unknown> = {};
        for (const k of ['eq', 'is', 'select', 'not', 'in', 'gt']) chain[k] = () => chain;
        chain.maybeSingle = async () => boom;
        chain.single = async () => boom;
        chain.then = (ok: (v: unknown) => void) => ok(boom);
        return chain;
      };
      return q;
    },
  } as unknown as SupabaseClient;
}

function lot(exit: string | null = null) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 6, cleans_by: 'AS', cleans_at: 'x', dirties: 9, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_standby: [],
    lot_bay_log: [{ id: 7, vehicle_id: 'v1', plate: 'A041YN', exit, exited_at: exit ? NOW : null, took_dirty: exit === 'clean', shift_day: TODAY,
      started_at: NOW, redo_of: null, pulled_by: null, note: null, hold_id: null, was_exit: null, sent_up: false, sent_at_exit: false }],
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], log: () => tables.lot_bay_log[0] };
}

describe('⭐ exitCar: the line fails after the count moved', () => {
  it('the +1 and the dirty it took both go back, and the error still reaches him', async () => {
    const l = lot();
    const db = failing(l.db, 'lot_bay_log', () => true);
    await expect(exitCar(db, 7, 'clean', 'AS', NOW, TODAY, undefined, false)).rejects.toMatchObject({ message: 'connection reset' });
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 9 });
    expect(l.log()).toMatchObject({ exit: null });
  });

  it('a held exit takes a dirty; its failed line gives the dirty back', async () => {
    const l = lot();
    const db = failing(l.db, 'lot_bay_log', () => true);
    await expect(exitCar(db, 7, 'bhold', 'AS', NOW, TODAY, undefined, false)).rejects.toBeTruthy();
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 9 });
  });

  it('the control: with no failure, the same exit lands +1 and a dirty off', async () => {
    const l = lot();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, undefined, false);
    expect(l.bay()).toMatchObject({ cleans: 7, dirties: 8 });
    expect(l.log()).toMatchObject({ exit: 'clean' });
  });
});

describe('undoExit: the car went back in, then the count failed', () => {
  it('says the car is back and the count did not move, never a bare "did not save"', async () => {
    const l = lot('clean');
    const db = failing(l.db, 'lot_bay', () => true);
    const err = await undoExit(db, 7, 'AS', SOON, TODAY).catch(e => e);
    expect(err).toBeInstanceOf(BayLogRefusal);
    expect(err.message).toBe('A041YN is back in the bay, but the count did not move. Check it.');
    expect(l.log()).toMatchObject({ exit: null });
  });
});

describe('changeExit: the line changed, then the count failed', () => {
  it('says the line changed and the count did not, instead of throwing a bare error', async () => {
    const l = lot('clean');
    const db = failing(l.db, 'lot_bay', () => true);
    const err = await changeExit(db, 7, 'bhold', 'AS', SOON, TODAY).catch(e => e);
    expect(err).toBeInstanceOf(BayLogRefusal);
    expect(err.message).toBe('A041YN changed, but the cleans count did not move. Check it.');
    expect(l.log()).toMatchObject({ exit: 'bhold' });
  });
});
