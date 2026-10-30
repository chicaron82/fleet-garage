// A bay car that leaves on M hold or B hold takes one off Erin St's dirties (api/_lib/lotBayLogDb.ts). Aaron,
// 2026-10-29: *"when i tap M hold/B hold would the clean count remain untouched and the dirty count drop?"*, ruled
// "yes". Skip moves nothing (the car goes back in the queue). Ticket: docs/ticket-bay-hold-exit-takes-a-dirty.md.
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BayLogRefusal, exitCar, undoExit } from '../../api/_lib/lotBayLogDb';

type Row = Record<string, unknown>;

/** Just the chains exitCar / undoExit / moveCount issue: select|update → eq|is → single|maybeSingle, and insert. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  const from = (t: string) => {
    let patch: Row | null = null;
    const filters: [string, unknown][] = [];
    const run = () => {
      const hit = tables[t].filter(r => filters.every(([k, v]) => r[k] === v));
      if (patch) hit.forEach(r => Object.assign(r, patch));
      return hit.map(r => ({ ...r }));
    };
    const q = {
      select: () => q,
      update: (p: Row) => { patch = p; return q; },
      insert: (r: Row) => { tables[t].push({ ...r }); return Promise.resolve({ data: null, error: null }); },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      is: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      single: async () => { const r = run(); return r.length === 1 ? { data: r[0], error: null } : { data: null, error: new Error(`${r.length} rows`) }; },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
    };
    return q;
  };
  return { from } as unknown as SupabaseClient;
}

const NOW = '2026-10-29T22:06:00.000Z';
const TODAY = '2026-10-29';
const AFTER = '2026-10-29T22:06:05.000Z';

function lot(dirties: number | null, logOver: Row = {}) {
  const tables: Record<string, Row[]> = {
    lot_bay: [{ id: 1, cleans: 6, cleans_by: 'AS', cleans_at: 'x', dirties, dirties_by: 'AS', dirties_at: 'x', used: 4, used_on: TODAY }],
    lot_bay_taps: [],
    lot_bay_log: [{ id: 7, plate: '0GK487', exit: null, exited_at: null, took_dirty: false, ...logOver }],
  };
  return { tables, db: fakeDb(tables), bay: () => tables.lot_bay[0], log: () => tables.lot_bay_log[0] };
}

describe('⭐ M hold / B hold: one off the dirties, the cleans untouched', () => {
  for (const kind of ['mhold', 'bhold'] as const) {
    it(`${kind}: dirties −1, cleans as they were, and the row remembers it took one`, async () => {
      const l = lot(23);
      await exitCar(l.db, 7, kind, 'AS', NOW, TODAY);
      expect(l.bay()).toMatchObject({ cleans: 6, cleans_at: 'x', dirties: 22, dirties_by: 'AS', dirties_at: NOW });
      expect(l.log()).toMatchObject({ exit: kind, exited_at: NOW, took_dirty: true });
      expect(l.tables.lot_bay_taps).toEqual([{ kind: 'held', value: 22, prev: 23, tapped_by: 'AS' }]);
    });
  }

  it('dirties at 0, or never counted, stay put: the hold still closes, nothing is taken, nothing logged', async () => {
    for (const d of [0, null]) {
      const l = lot(d);
      await exitCar(l.db, 7, 'mhold', 'AS', NOW, TODAY);
      expect(l.bay()).toMatchObject({ dirties: d, dirties_at: 'x' });
      expect(l.log()).toMatchObject({ exit: 'mhold', took_dirty: false });
      expect(l.tables.lot_bay_taps).toEqual([]);
    }
  });

  it('Skip moves no count: the car goes back in the queue', async () => {
    const l = lot(23);
    await exitCar(l.db, 7, 'skip', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
    expect(l.tables.lot_bay_taps).toEqual([]);
  });

  it('Clean is as it was: +1 clean, −1 dirty', async () => {
    const l = lot(23);
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 7, dirties: 22 });
  });
});

describe('the dirty comes back exactly when it was taken', () => {
  it('Undo of a hold that took a dirty gives it back', async () => {
    const l = lot(23);
    await exitCar(l.db, 7, 'bhold', 'AS', NOW, TODAY);
    await undoExit(l.db, 7, 'AS', AFTER, TODAY);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
    expect(l.log()).toMatchObject({ exit: null, took_dirty: false });
  });

  it('⚠️ Undo of a hold that took nothing (dirties were 0) never invents one', async () => {
    const l = lot(0);
    await exitCar(l.db, 7, 'mhold', 'AS', NOW, TODAY);
    await undoExit(l.db, 7, 'AS', AFTER, TODAY);
    expect(l.bay()).toMatchObject({ dirties: 0 });
  });

  it('⚠️ the car already left (another phone): refused, and the dirty is put back', async () => {
    const l = lot(23, { exit: 'skip', exited_at: '2026-10-29T22:05:59.000Z' });
    await expect(exitCar(l.db, 7, 'mhold', 'AS', NOW, TODAY)).rejects.toThrow(BayLogRefusal);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 23 });
  });
});
