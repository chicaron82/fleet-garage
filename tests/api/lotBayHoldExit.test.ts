// A bay car that leaves on M hold or B hold takes one off Erin St's dirties (api/_lib/lotBayLogDb.ts). Aaron,
// 2026-10-29: *"when i tap M hold/B hold would the clean count remain untouched and the dirty count drop?"*, ruled
// "yes". Skip moves nothing (the car goes back in the queue). Ticket: docs/ticket-bay-hold-exit-takes-a-dirty.md.
import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { BayLogRefusal, bumpToNextUp, clearStandby, exitCar, setStandby, startCar, undoExit } from '../../api/_lib/lotBayLogDb';

type Row = Record<string, unknown>;

/** Just the chains exitCar / undoExit / moveCount issue: select|update → eq|is → single|maybeSingle, and insert. */
function fakeDb(tables: Record<string, Row[]>): SupabaseClient {
  let nextId = 100;
  const from = (t: string) => {
    let patch: Row | null = null;
    let inserted: Row | null = null;
    const filters: [string, unknown][] = [];
    let deleting = false;
    const run = () => {
      const hit = (tables[t] ?? []).filter(r => filters.every(([k, v]) => r[k] === v));
      if (patch) hit.forEach(r => Object.assign(r, patch));
      return hit.map(r => ({ ...r }));
    };
    const q = {
      select: () => q,
      update: (p: Row) => { patch = p; return q; },
      insert: (r: Row) => { const row = t === 'lot_bay_log' ? { id: nextId++, exit: null, ...r } : { ...r }; tables[t].push(row); inserted = row; return q; },
      upsert: (r: Row) => { tables[t] = [{ ...r }]; inserted = tables[t][0]; return q; },
      delete: () => { deleting = true; return q; },
      eq: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      is: (k: string, v: unknown) => { filters.push([k, v]); return q; },
      then: (ok: (v: unknown) => void) => {
        if (!deleting) return ok({ data: null, error: null });
        const gone = (tables[t] ?? []).filter(r => filters.every(([k, v]) => r[k] === v));
        tables[t] = (tables[t] ?? []).filter(r => !gone.includes(r));
        return ok({ data: gone.map(r => ({ ...r })), error: null });
      },
      single: async () => { if (inserted) return { data: { ...inserted }, error: null }; const r = run(); return r.length === 1 ? { data: r[0], error: null } : { data: null, error: new Error(`${r.length} rows`) }; },
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
    lot_bay_standby: [],
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

describe('an exit keeps the reading logged from the bay card', () => {
  it('on the row when one came with it, and the row is untouched when none did', async () => {
    const l = lot(3, { odometer: null });
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, 21500);
    expect(l.log().odometer).toBe(21500);
    const m = lot(3, { odometer: 20000 });
    await exitCar(m.db, 7, 'skip', 'AS', NOW, TODAY);
    expect(m.log().odometer).toBe(20000);
  });
});

// ⭐ Aaron, 2026-11-02: *"tapping cleaned, starts the next one if one is loaded?"*, and every exit does (migration 163).
describe('Next up: every exit pulls the lined-up car in', () => {
  const seltos = { id: 'v-487', license_plate: 'NXT487', unit_number: '5429550', year: 2026, make: 'Kia', model: 'Seltos', color: 'Gray', odometer: 100, odometer_at: null };
  function loaded(over: Row = {}) {
    const l = lot(3);
    l.tables.vehicles = [seltos];
    l.tables.lot_bay_standby = [{ id: 1, vehicle_id: 'v-487', plate: 'NXT487', shift_day: TODAY, ...over }];
    return l;
  }
  const inBay = (l: ReturnType<typeof lot>) => l.tables.lot_bay_log.filter(r => r.exit == null);

  for (const kind of ['clean', 'skip', 'mhold', 'bhold'] as const) {
    it(`${kind} pulls it in, names the exit that did, and empties the slot`, async () => {
      const l = loaded();
      const out = await exitCar(l.db, 7, kind, 'AS', NOW, TODAY);
      expect(inBay(l).map(r => r.plate)).toEqual(['NXT487']);
      expect(inBay(l)[0].pulled_by).toBe(7);
      expect(l.tables.lot_bay_standby).toEqual([]);
      expect(out).toHaveProperty('next');
      expect(out).not.toHaveProperty('nextError');
    });
  }

  it('control: nothing loaded, nothing comes in', async () => {
    const l = lot(3);
    l.tables.vehicles = [seltos];
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(inBay(l)).toEqual([]);
  });

  it('⚠️ a plate loaded before the cutover never starts, and the slot empties', async () => {
    const l = loaded({ shift_day: '2026-10-28' });
    const out = await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(inBay(l)).toEqual([]);
    expect(l.tables.lot_bay_standby).toEqual([]);
    expect(out).not.toHaveProperty('nextError');
  });

  it('⚠️ a pull that cannot happen leaves the exit standing and the car loaded, and says so', async () => {
    const l = loaded();
    l.tables.vehicles = [];      // the car is gone from FG
    const out = await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(l.log().exit).toBe('clean');
    expect(l.tables.lot_bay_standby).toHaveLength(1);
    expect((out as { nextError?: string }).nextError).toMatch(/NXT487 did not come in/);
  });

  it('⭐ Clean\'s Undo rewinds both: the next car back on Next up, the first back in, the count back', async () => {
    const l = loaded();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY);
    expect(l.bay().cleans).toBe(7);
    const out = await undoExit(l.db, 7, 'AS', AFTER, TODAY) as { removedId?: unknown };
    expect(inBay(l).map(r => r.plate)).toEqual(['0GK487']);
    expect(l.log().exit).toBeNull();
    expect(l.bay().cleans).toBe(6);
    expect(l.tables.lot_bay_standby[0]).toMatchObject({ vehicle_id: 'v-487', plate: 'NXT487', shift_day: TODAY });
    expect(out).toHaveProperty('removedId');
  });

  it('a Start by any door clears the slot when it is that car', async () => {
    const l = loaded();
    l.tables.lot_bay_log[0].exit = 'clean';
    await startCar(l.db, 'v-487', 'AS', NOW, TODAY);
    expect(l.tables.lot_bay_standby).toEqual([]);
  });

  it('lining up: replaces what was there, refuses the car in the bay; clear empties it', async () => {
    const l = lot(3, { vehicle_id: 'v-in' });
    l.tables.vehicles = [seltos];
    const { standby } = await setStandby(l.db, 'v-487', 'AS', NOW, TODAY);
    expect(standby).toMatchObject({ plate: 'NXT487' });
    await expect(setStandby(l.db, 'v-in', 'AS', NOW, TODAY)).rejects.toThrow(/in the bay now/);
    await clearStandby(l.db);
    expect(l.tables.lot_bay_standby).toEqual([]);
  });

  // Aaron, 2026-11-03: *"[Start Clean][On Deck] ... On deck loads it as the next vehicle"*, with the bay empty for the
  // airport runs. This was refused ("The bay's empty. Start this car instead.") until today.
  it('⭐ On deck with the bay EMPTY: the car is loaded, nothing goes in', async () => {
    const l = lot(3, { vehicle_id: 'v-in', exit: 'clean', exited_at: NOW });
    l.tables.vehicles = [seltos];
    const { standby } = await setStandby(l.db, 'v-487', 'AS', NOW, TODAY);
    expect(standby).toMatchObject({ plate: 'NXT487', vehicle_id: 'v-487' });
    expect(l.tables.lot_bay_log.filter(r => r.exit == null)).toEqual([]);
  });
});

// Aaron, 2026-11-03, first real morning on Next up: *"When I tapped clean on the first it started the next. Problem, we
// had to do trips to the airport. So I skipped it to stop the clean."* Then *"Both"*. docs/ticket-bay-clean-only-and-back-to-next-up.md
describe('Clean only, and Back to Next up', () => {
  const seltos = { id: 'v-487', license_plate: 'NXT487', unit_number: '5429550', year: 2026, make: 'Kia', model: 'Seltos', color: 'Gray', odometer: 100, odometer_at: null };
  function loaded() {
    const l = lot(3, { vehicle_id: 'v-in', unit_number: '5400001', car: '2026 Chevrolet Trax · Black' });
    l.tables.vehicles = [seltos];
    l.tables.lot_bay_standby = [{ id: 1, vehicle_id: 'v-487', plate: 'NXT487', shift_day: TODAY }];
    return l;
  }
  const inBay = (l: ReturnType<typeof lot>) => l.tables.lot_bay_log.filter(r => r.exit == null);

  it('⭐ Clean only: the car closes and counts, and Next up\'s car stays loaded', async () => {
    const l = loaded();
    const out = await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, undefined, false);
    expect(l.log()).toMatchObject({ exit: 'clean' });
    expect(l.bay().cleans).toBe(7);
    expect(inBay(l)).toEqual([]);
    expect(l.tables.lot_bay_standby).toEqual([expect.objectContaining({ plate: 'NXT487' })]);
    expect(out).not.toHaveProperty('next');
  });

  it('…and its Undo reopens the car with the slot untouched', async () => {
    const l = loaded();
    await exitCar(l.db, 7, 'clean', 'AS', NOW, TODAY, undefined, false);
    await undoExit(l.db, 7, 'AS', AFTER, TODAY);
    expect(inBay(l).map(r => r.plate)).toEqual(['0GK487']);
    expect(l.bay().cleans).toBe(6);
    expect(l.tables.lot_bay_standby).toEqual([expect.objectContaining({ plate: 'NXT487' })]);
  });

  it('⭐ Back to Next up: the row goes, nothing counts, and the car is lined up', async () => {
    const l = lot(3, { vehicle_id: 'v-in', unit_number: '5400001', car: '2026 Chevrolet Trax · Black' });
    const out = await bumpToNextUp(l.db, 7, 'AS', NOW, TODAY, false);
    expect(l.tables.lot_bay_log).toEqual([]);
    expect(l.bay()).toMatchObject({ cleans: 6, dirties: 3 });
    expect(l.tables.lot_bay_taps).toEqual([]);
    expect(l.tables.lot_bay_standby).toEqual([expect.objectContaining({ vehicle_id: 'v-in', plate: '0GK487', car: '2026 Chevrolet Trax · Black', shift_day: TODAY, loaded_by: 'AS' })]);
    expect(out).toMatchObject({ removedId: 7 });
  });

  it('⚠️ a different car on Next up is never bumped without his yes, and is with it', async () => {
    const l = loaded();
    await expect(bumpToNextUp(l.db, 7, 'AS', NOW, TODAY, false)).rejects.toThrow(/NXT487 is on deck/);
    expect(inBay(l)).toHaveLength(1);
    expect(l.tables.lot_bay_standby[0]).toMatchObject({ plate: 'NXT487' });
    await bumpToNextUp(l.db, 7, 'AS', NOW, TODAY, true);
    expect(inBay(l)).toEqual([]);
    expect(l.tables.lot_bay_standby).toEqual([expect.objectContaining({ vehicle_id: 'v-in' })]);
  });

  it('yesterday\'s plate on the slot is no car to protect', async () => {
    const l = loaded();
    l.tables.lot_bay_standby[0].shift_day = '2026-10-28';
    await bumpToNextUp(l.db, 7, 'AS', NOW, TODAY, false);
    expect(l.tables.lot_bay_standby).toEqual([expect.objectContaining({ vehicle_id: 'v-in' })]);
  });

  it('⚠️ a car that already left (another phone) is refused, and its row is never deleted', async () => {
    const l = lot(3, { exit: 'clean', exited_at: NOW });
    await expect(bumpToNextUp(l.db, 7, 'AS', NOW, TODAY, false)).rejects.toThrow(BayLogRefusal);
    expect(l.tables.lot_bay_log).toHaveLength(1);
    expect(l.tables.lot_bay_standby).toEqual([]);
  });
});
