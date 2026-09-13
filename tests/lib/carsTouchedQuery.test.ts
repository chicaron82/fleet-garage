import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ratesForBasis } from '../../src/lib/carsTouchedQuery';
import type { ShiftSnapshot } from '../../src/lib/shift-metrics';

let rows: { vehicle_id: string; actor: string | null; changed_at: string }[] = [];
let queryError: { message: string } | null = null;
const selectSpy = vi.fn();

const builder: Record<string, unknown> = {
  select: (...a: unknown[]) => { selectSpy(...a); return builder; },
  gte: () => builder,
  lte: () => builder,
  then: (resolve: (v: unknown) => void) => resolve({ data: queryError ? null : rows, error: queryError }),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => builder },
}));

const HIM = 'aaron';
const WINDOW_START = Date.parse('2026-09-11T11:45:00Z');   // 06:45 CDT
const WINDOW_END   = Date.parse('2026-09-11T20:15:00Z');   // 15:15 CDT
const DAY = { dayStartISO: '2026-09-11T09:00:00Z', dayEndISO: '2026-09-12T09:00:00Z' };

// 8.5h window, 30 min off-standard — the gas-sheet basis had 57 cars through it.
const snapshot = { cleaned: 57, hours: 8.5, oth: 30 } as ShiftSnapshot;
const gas = { baseline: 6.7, yourEffort: 7.1 };

const base = { snapshot, gas, userId: HIM, windowStartMs: WINDOW_START, windowEndMs: WINDOW_END, ...DAY };

beforeEach(() => { rows = []; queryError = null; selectSpy.mockClear(); });

describe('ratesForBasis', () => {
  it('⭐ the gas-sheet basis costs NOTHING — it never touches the database', async () => {
    const out = await ratesForBasis({ ...base, basis: 'gas-sheet' });
    expect(selectSpy).not.toHaveBeenCalled();
    expect(out).toEqual({ ...gas, carsTouched: null });
  });

  it('⭐ the cars-touched basis re-rates on the distinct count', async () => {
    rows = [
      { vehicle_id: 'a', actor: HIM, changed_at: '2026-09-11T13:00:00Z' },
      { vehicle_id: 'a', actor: HIM, changed_at: '2026-09-11T13:05:00Z' },  // same car twice
      { vehicle_id: 'b', actor: HIM, changed_at: '2026-09-11T14:00:00Z' },
    ];
    const out = await ratesForBasis({ ...base, basis: 'cars-touched' });
    expect(out.carsTouched).toBe(2);
    // 2 cars / (8.5h − 0.5h off-standard) = 0.25/hr — a different number from the gas-sheet rate.
    expect(out.yourEffort).toBeCloseTo(0.25, 2);
    expect(out.baseline).toBeCloseTo(2 / 8.5, 3);
  });

  it('⚠️ the DENOMINATOR is untouched — only the numerator changes', async () => {
    // Aaron's decision #3: hours stay dependent on off-standard by the existing rules.
    rows = [{ vehicle_id: 'a', actor: HIM, changed_at: '2026-09-11T13:00:00Z' }];
    const out = await ratesForBasis({ ...base, basis: 'cars-touched' });
    expect(out.baseline).toBeCloseTo(1 / 8.5, 4);            // same 8.5h window
    expect(out.yourEffort).toBeCloseTo(1 / 8, 4);            // same off-standard deduction
  });

  it('⚠️ falls back to the gas-sheet rates when the query fails, never to a blank or a zero', async () => {
    queryError = { message: 'network' };
    const out = await ratesForBasis({ ...base, basis: 'cars-touched' });
    expect(out).toEqual({ ...gas, carsTouched: null });
  });

  it('⚠️ falls back when the shift window cannot be resolved', async () => {
    const out = await ratesForBasis({ ...base, basis: 'cars-touched', windowStartMs: null, windowEndMs: null });
    expect(selectSpy).not.toHaveBeenCalled();
    expect(out).toEqual({ ...gas, carsTouched: null });
  });

  it('⚠️⚠️ never folds another actor\'s work into his rate', async () => {
    rows = [
      { vehicle_id: 'a', actor: HIM,        changed_at: '2026-09-11T13:00:00Z' },
      { vehicle_id: 'b', actor: 'somebody', changed_at: '2026-09-11T13:30:00Z' },
    ];
    const out = await ratesForBasis({ ...base, basis: 'cars-touched' });
    expect(out.carsTouched).toBe(1);
  });

  it('a day with no changes of his is 0, which is a true statement about the shift', async () => {
    rows = [{ vehicle_id: 'a', actor: 'somebody', changed_at: '2026-09-11T13:00:00Z' }];
    const out = await ratesForBasis({ ...base, basis: 'cars-touched' });
    expect(out.carsTouched).toBe(0);
    expect(out.yourEffort).toBe(0);
  });
});
