// ⚠️⚠️ WHY THIS EXISTS — the seam defect that no unit test could see.
//
// Aaron, 2026-09-17, with the two screenshots side by side: *"shouldn't flipping between the two
// produce different rates? Yesterday because they were flipping returns at the airport the gas
// sheet entries were bare. But cars touched was high."*
//
// He was right. The `Gas sheet` ↔ `Cars I touched` toggle moved the "Cars cleaned" row and NOTHING
// else: `resolveNumerator` produced the chosen numerator, and then the card handed
// `creditFlipsToRate` the raw gas-sheet snapshot anyway. Both rates went on dividing the gas-sheet
// figure, so the card under-reported on exactly the airport-flip day the toggle exists for.
//
// ⭐ BOTH SIDES WERE ALREADY TESTED. `tests/lib/shift-metrics.test.ts` covers `creditFlipsToRate`;
// `tests/lib/throughputBasis.test.ts` covers `resolveNumerator`. Both passed all day while this was
// broken, because the defect lived in the WIRING between them. A unit test cannot reach a seam —
// only a test that renders the card and flips the basis can. That is the entire point of this file.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { TouchedCount } from '../../src/lib/throughputBasis';

const q = () => {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'eq', 'gte', 'or']) b[m] = () => b;
  b.then = (res: (r: { data: unknown[] }) => void) => { res({ data: [] }); return Promise.resolve(); };
  return b;
};
vi.mock('../../src/lib/supabase', () => ({ supabase: { from: () => q() } }));

// ⚠️ `today` lives in the hoisted state and is filled in `beforeEach`, NOT at module scope. The
// mock factories are hoisted above the imports, so a module-scope `const today = localDateStr(0)`
// would be in its TDZ when a factory ran. The hooks are only CALLED at render time, by which point
// beforeEach has run — so reading it lazily inside each factory is both safe and honest about the
// business-date cutover (it uses the real helper rather than re-deriving the rule here).
const state = vi.hoisted(() => ({
  basis: 'gas-sheet' as 'gas-sheet' | 'cars-touched',
  touched: null as TouchedCount | null,
  flips: 0,
  today: '',
}));
const updatePref = vi.hoisted(() => vi.fn());

// ⚠️ STABLE IDENTITIES, NOT FRESH OBJECTS. The card's off-standard effect has `[user]` in its deps,
// so a mock returning `{ user: { id: 'u1' } }` fresh each render re-fires it every render → setState
// → render → forever. It does not fail the test, it hangs the worker until the heap dies (it ran
// 1311s and executed zero assertions). Any mocked value that reaches a dep array must be hoisted.
const auth = vi.hoisted(() => ({ user: { id: 'u1' } }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => auth }));
vi.mock('../../src/context/PreferencesContext', () => ({
  usePreferences: () => ({ prefs: { throughputBasis: state.basis }, updatePref }),
}));
vi.mock('../../src/hooks/useAirportFlip', () => ({
  useAirportFlip: () => ({ rows: Array.from({ length: state.flips }, (_, i) => ({ id: `f${i}` })) }),
}));
vi.mock('../../src/hooks/useCarsTouched', () => ({ useCarsTouched: () => state.touched }));
vi.mock('../../src/context/WashbayContext', () => ({
  useWashbayContext: () => ({
    // ⭐ An OPENING: morning's count comes from the handoff alone, so the washbay log stays null.
    // 2 full pages + 16 = 54 — his real gas-sheet figure from the day this bug was found.
    handoffNotes: [{ loggedAt: `${state.today}T14:30:00`, fullPages: 2, lastPageEntries: 16 }],
    getTodayWashbayLog: () => null,
    getTodayCheckpoint: () => null,
    getMidArrival: () => null,
    getMidDeparture: () => null,
  }),
}));
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({
    // 06:45–15:15 = 8.5h clock − 0.5h unpaid lunch = an 8.0h window. Denominators stay round so a
    // failure reads as a wrong NUMERATOR, which is what this file is about.
    shifts: [{ userId: 'u1', date: state.today, shiftType: 'opening', startTime: '06:45', endTime: '15:15' }],
  }),
}));

import { localDateStr } from '../../src/hooks/useFleetBalance';
import { ShiftRatesCard } from '../../src/components/analytics/ShiftRatesCard';

const count = (distinct: number): TouchedCount =>
  ({ distinct, rows: distinct, outsideWindow: 0, otherActors: 0 });

describe('ShiftRatesCard — the basis toggle must reach the RATES, not just the count', () => {
  beforeEach(() => {
    state.today = localDateStr(0);
    state.basis = 'gas-sheet';
    state.touched = null;
    state.flips = 3;      // his live airport flips that day
    updatePref.mockClear();
  });

  it('gas-sheet basis: 54 + 3 flips over an 8.0h window reads 7.1/hr', () => {
    render(<ShiftRatesCard />);
    expect(screen.getByText('54')).toBeInTheDocument();
    // Baseline and effort are equal with no off-standard logged — BOTH must read 7.1.
    expect(screen.getAllByText('7.1 / hr')).toHaveLength(2);
  });

  it('⭐⭐ THE BUG: flipping to cars-touched moves the RATES, not only the count row', () => {
    state.basis = 'cars-touched';
    state.touched = count(59);
    render(<ShiftRatesCard />);
    expect(screen.getByText('59')).toBeInTheDocument();
    // 59 + 3 = 62 over 8.0h = 7.75 → 7.8. Before the fix this rendered 7.1 — the gas-sheet rate —
    // while the row above it said 59. ⚠️ Two numbers on one card that could not both be true.
    expect(screen.getAllByText('7.8 / hr')).toHaveLength(2);
    expect(screen.queryByText('7.1 / hr')).toBeNull();
  });

  it('the count row and the rate always describe the SAME number of cars', () => {
    state.basis = 'cars-touched';
    state.touched = count(40);
    render(<ShiftRatesCard />);
    expect(screen.getByText('40')).toBeInTheDocument();
    expect(screen.getAllByText('5.4 / hr')).toHaveLength(2);   // (40 + 3) / 8
  });

  it('flips still credit on the touched basis — the +3 line and the numerator agree', () => {
    state.basis = 'cars-touched';
    state.touched = count(59);
    render(<ShiftRatesCard />);
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('…and with no flips the touched count stands alone', () => {
    state.basis = 'cars-touched';
    state.touched = count(59);
    state.flips = 0;
    render(<ShiftRatesCard />);
    expect(screen.getAllByText('7.4 / hr')).toHaveLength(2);   // 59 / 8 = 7.375
    expect(screen.queryByText('+3')).toBeNull();
  });

  // ⭐ Aaron's call on the loading beat: blank it. A wrong-basis rate is the thing being fixed, so
  // flashing the gas-sheet number for half a second is just a shorter version of the same bug.
  // ⚠️ This also pins a CRASH: the old gate read the gas-sheet `yourEffort`, which is non-null here,
  // so the block rendered and `dispEffort!.toFixed(1)` ran on null.
  it('⚠️ while the touched count is still loading the rate block is BLANK, not stale', () => {
    state.basis = 'cars-touched';
    state.touched = null;
    render(<ShiftRatesCard />);
    expect(screen.getByText('Counting your shift…')).toBeInTheDocument();
    expect(screen.queryByText('Your effort')).toBeNull();
    expect(screen.queryByText('7.1 / hr')).toBeNull();   // the stale gas-sheet rate must not appear
  });

  it('the toggle is wired to the preference, so the choice survives the session', () => {
    render(<ShiftRatesCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Cars I touched' }));
    expect(updatePref).toHaveBeenCalledWith('throughputBasis', 'cars-touched');
  });
});
