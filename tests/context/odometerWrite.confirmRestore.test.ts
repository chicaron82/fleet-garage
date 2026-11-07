// "Still reads X" and Undo, server side (2026-11-07, docs/ticket-odo-same-reading-and-undo.md). Aaron: *"no change - for
// situations where it was logged earlier, but sat"* and *"revert to last entered/previous odo"* (LUR184's reading meant
// for LUR185, cleared and re-typed, which put the old number back with today's date).
import { describe, it, expect, vi, beforeEach } from 'vitest';

let answer: { data: unknown; error: unknown };
const writes: { patch: Record<string, unknown>; eqs: [string, unknown][] }[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (patch: Record<string, unknown>) => {
        const w = { patch, eqs: [] as [string, unknown][] };
        writes.push(w);
        const chain = { eq: (k: string, v: unknown) => { w.eqs.push([k, v]); return chain; }, select: async () => answer };
        return chain;
      },
    }),
  },
  writeWithRefresh: (run: () => Promise<unknown>) => run(),
}));
const commitSightingFor = vi.fn();
vi.mock('../../src/hooks/useVehicleSightings', () => ({ commitSightingFor: (id: string) => commitSightingFor(id) }));

const { makeConfirmOdometer, makeRestoreOdometer } = await import('../../src/context/odometerWrite');
const setAllVehicles = vi.fn();

beforeEach(() => { writes.length = 0; setAllVehicles.mockClear(); commitSightingFor.mockClear(); answer = { data: [{ id: 'v1' }], error: null }; });

describe('confirmOdometer — "Still reads X"', () => {
  it('⭐ moves only the DATE, guarded on the value, and counts as being at the car', async () => {
    expect(await makeConfirmOdometer({ setAllVehicles })('v1', 47420)).toBe(true);
    expect(Object.keys(writes[0]!.patch)).toEqual(['odometer_at']);
    expect(writes[0]!.eqs).toEqual([['id', 'v1'], ['odometer', 47420]]);
    expect(commitSightingFor).toHaveBeenCalledWith('v1');
    expect(setAllVehicles).toHaveBeenCalledTimes(1);
  });

  it('a different reading landed meanwhile (0 rows): false, and nothing changes here', async () => {
    answer = { data: [], error: null };
    expect(await makeConfirmOdometer({ setAllVehicles })('v1', 47420)).toBe(false);
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
});

describe('restoreOdometer — Undo', () => {
  it('⭐ puts back the old number AND its old date, only if the just-saved reading still stands', async () => {
    expect(await makeRestoreOdometer({ setAllVehicles })('v1', 52869, 47420, '2026-10-26T03:00:00+00:00')).toBe(true);
    expect(writes[0]!.patch).toEqual({ odometer: 47420, odometer_at: '2026-10-26T03:00:00+00:00' });
    expect(writes[0]!.eqs).toEqual([['id', 'v1'], ['odometer', 52869]]);
  });

  it('undoing a FIRST reading returns the car to "not logged"', async () => {
    await makeRestoreOdometer({ setAllVehicles })('v1', 52869, null, null);
    expect(writes[0]!.patch).toEqual({ odometer: null, odometer_at: null });
  });

  it('⚠️ a newer reading since: false, never undone, nothing changes here', async () => {
    answer = { data: [], error: null };
    expect(await makeRestoreOdometer({ setAllVehicles })('v1', 52869, 47420, '2026-10-26T03:00:00+00:00')).toBe(false);
    expect(setAllVehicles).not.toHaveBeenCalled();
  });

  it('a failed write: false', async () => {
    answer = { data: null, error: new Error('offline') };
    expect(await makeRestoreOdometer({ setAllVehicles })('v1', 52869, 47420, null)).toBe(false);
  });
});
