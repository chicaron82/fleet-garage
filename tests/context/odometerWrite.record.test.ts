// recordOdometer says whether anything was lost (2026-11-02, docs/ticket-odo-capture-claims-saved.md). It used to swallow a
// failed write, so the capture box read "saved" on a weak signal and the flip's "didn't save" note could never name it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let answer: { data: unknown; error: unknown };
const writes: Record<string, unknown>[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => ({ update: (p: Record<string, unknown>) => { writes.push(p); return { eq: () => ({ or: () => ({ select: async () => answer }) }) }; } }) },
  writeWithRefresh: (run: () => Promise<unknown>) => run(),
}));
vi.mock('../../src/hooks/useVehicleSightings', () => ({ commitSightingFor: vi.fn() }));

const { makeRecordOdometer } = await import('../../src/context/odometerWrite');
const setAllVehicles = vi.fn();
const record = (stored: number | null) => makeRecordOdometer({ setAllVehicles, currentOdometer: () => stored });

beforeEach(() => { writes.length = 0; setAllVehicles.mockClear(); answer = { data: [{ id: 'v1' }], error: null }; });

describe('recordOdometer', () => {
  it('a reading that landed: true, and the car updates', async () => {
    expect(await record(100)('v1', 200)).toBe(true);
    expect(writes).toHaveLength(1);
    expect(setAllVehicles).toHaveBeenCalledTimes(1);
  });
  it('⚠️ a failed write: false, and the car does NOT update', async () => {
    answer = { data: null, error: new Error('offline') };
    expect(await record(100)('v1', 200)).toBe(false);
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
  it('a higher reading got there first: nothing lost, so true, and no divergence', async () => {
    answer = { data: [], error: null };
    expect(await record(100)('v1', 200)).toBe(true);
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
  it('a reading not above what is on file: the guard, not a loss, and no write', async () => {
    expect(await record(300)('v1', 200)).toBe(true);
    expect(writes).toHaveLength(0);
  });
});
