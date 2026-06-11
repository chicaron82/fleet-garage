import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Hold, Repair } from '../../src/types';

// ── Mocks ────────────────────────────────────────────────────────────────────
// writeWithRefresh executes the query callback (so we can see which tables get
// written) and reports success; the supabase stub records every from() chain.

const fromCalls: string[] = [];
const chain = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  eq:     vi.fn(() => chain),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      fromCalls.push(table);
      return chain;
    }),
  },
  writeWithRefresh: vi.fn(async (fn: () => unknown) => {
    fn();
    return { error: null };
  }),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  pushNotification: vi.fn().mockResolvedValue(undefined),
}));

const { makeMarkRepairedBatch } = await import('../../src/context/holdResolution');

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeHold(id: string, vehicleId: string): Hold {
  return {
    id, vehicleId,
    holdTypes: ['damage'], holdType: 'damage',
    damageDescription: 'scrape', notes: '',
    flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
    flaggedAt: '2026-06-11T08:00:00.000Z',
    status: 'ACTIVE', branchId: 'YWG',
  };
}

const REPAIR: Omit<Repair, 'id'> = {
  holdId: '', repairedById: 'mgr-1', repairedAt: '2026-06-11T09:00:00.000Z',
  notes: 'fixed', outcome: 'clean',
};

function deps(holds: Hold[]) {
  return {
    holds,
    setAllHolds: vi.fn(),
    setAllVehicles: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  fromCalls.length = 0;
});

// ── The single-vehicle contract ──────────────────────────────────────────────
// The batch projects holds filtered by ONE vehicleId and derives that vehicle
// once; a cross-vehicle batch would write every repair but re-derive only the
// first vehicle. The guard must fire BEFORE any write lands.

describe('makeMarkRepairedBatch single-vehicle guard', () => {
  it('refuses a cross-vehicle batch before writing anything', async () => {
    const d = deps([makeHold('h-1', 'v-1'), makeHold('h-2', 'v-2')]);
    const batch = makeMarkRepairedBatch(d);

    await expect(batch(['h-1', 'h-2'], REPAIR)).rejects.toThrow(
      'Batch repair must target holds on a single vehicle'
    );
    expect(fromCalls).toEqual([]);          // zero writes committed
    expect(d.setAllHolds).not.toHaveBeenCalled();
    expect(d.setAllVehicles).not.toHaveBeenCalled();
  });

  it('refuses an empty batch before writing anything', async () => {
    const d = deps([makeHold('h-1', 'v-1')]);
    const batch = makeMarkRepairedBatch(d);

    await expect(batch([], REPAIR)).rejects.toThrow('No holds to repair');
    expect(fromCalls).toEqual([]);
  });

  it('single-vehicle batch still flows: repairs per hold, vehicle derived once', async () => {
    const holds = [makeHold('h-1', 'v-1'), makeHold('h-2', 'v-1')];
    const d = deps(holds);
    const batch = makeMarkRepairedBatch(d);

    await batch(['h-1', 'h-2'], REPAIR);

    // Per hold: repairs insert + holds update. Then exactly ONE vehicles update.
    expect(fromCalls).toEqual(['repairs', 'holds', 'repairs', 'holds', 'vehicles']);
    // Both holds REPAIRED → the vehicle derives CLEAR, written once.
    expect(chain.update).toHaveBeenCalledWith({ status: 'CLEAR' });

    // State projection: both targets flip to REPAIRED with their repair attached.
    const updater = d.setAllHolds.mock.calls[0][0] as (prev: Hold[]) => Hold[];
    const next = updater(holds);
    expect(next.map(h => h.status)).toEqual(['REPAIRED', 'REPAIRED']);
    expect(next.every(h => h.repair?.holdId === h.id)).toBe(true);
  });
});
