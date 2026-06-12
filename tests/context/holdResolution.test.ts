import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Hold, HoldType, Repair } from '../../src/types';

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

const { makeMarkRepairedBatch, makeMarkIssueRepaired } = await import('../../src/context/holdResolution');

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeHold(id: string, vehicleId: string, overrides: Partial<Hold> = {}): Hold {
  return {
    id, vehicleId,
    holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
    damageDescription: 'scrape', notes: '',
    flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
    flaggedAt: '2026-06-11T08:00:00.000Z',
    status: 'ACTIVE', branchId: 'YWG',
    ...overrides,
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

// ── Per-issue resolution within one (multi-type) hold ────────────────────────
// A multi-type hold stays ACTIVE — and the vehicle stays held via the unchanged
// cascade — until resolved_types covers every hold_type; only then does it flip
// REPAIRED. Different axis from the batch above (several holds vs several issues).

describe('makeMarkIssueRepaired (per-issue resolution)', () => {
  it('intermediate: resolving a non-final issue records it and keeps the hold ACTIVE', async () => {
    const hold = makeHold('h-1', 'v-1', { holdTypes: ['damage', 'mechanical'] });
    const d = deps([hold]);

    await makeMarkIssueRepaired(d)('h-1', 'mechanical');

    expect(fromCalls).toEqual(['holds']);                            // resolved_types only
    expect(chain.update).toHaveBeenCalledWith({ resolved_types: ['mechanical'] });
    expect(d.setAllVehicles).not.toHaveBeenCalled();                 // vehicle stays held
    const patch = d.setAllHolds.mock.calls[0][0] as (prev: Hold[]) => Hold[];
    const after = patch([hold]);
    expect(after[0].status).toBe('ACTIVE');
    expect(after[0].resolvedTypes).toEqual(['mechanical']);
  });

  it('final: resolving the last issue flips the hold REPAIRED and clears the vehicle', async () => {
    const hold = makeHold('h-1', 'v-1', { holdTypes: ['damage', 'mechanical'], resolvedTypes: ['mechanical'] });
    const d = deps([hold]);

    await makeMarkIssueRepaired(d)('h-1', 'damage', REPAIR);

    expect(fromCalls).toEqual(['repairs', 'holds', 'vehicles']);
    expect(chain.update).toHaveBeenCalledWith({ status: 'CLEAR' });  // vehicle derives clear
    const patch = d.setAllHolds.mock.calls[0][0] as (prev: Hold[]) => Hold[];
    const after = patch([hold]);
    expect(after[0].status).toBe('REPAIRED');
    expect(after[0].resolvedTypes).toEqual(['mechanical', 'damage']);
    expect(after[0].repair?.outcome).toBe('clean');
  });

  it('the final flip requires repair details (notes/outcome)', async () => {
    const hold = makeHold('h-1', 'v-1', { holdTypes: ['damage', 'mechanical'], resolvedTypes: ['mechanical'] });
    const d = deps([hold]);

    await expect(makeMarkIssueRepaired(d)('h-1', 'damage')).rejects.toThrow('Repair details');
    expect(fromCalls).toEqual([]);                                   // nothing written
  });

  it('single-type hold: resolving its one issue flips REPAIRED at once', async () => {
    const hold = makeHold('h-1', 'v-1');                             // holdTypes ['damage']
    const d = deps([hold]);

    await makeMarkIssueRepaired(d)('h-1', 'damage', REPAIR);

    expect(fromCalls).toEqual(['repairs', 'holds', 'vehicles']);
    const patch = d.setAllHolds.mock.calls[0][0] as (prev: Hold[]) => Hold[];
    expect(patch([hold])[0].status).toBe('REPAIRED');
  });

  it('resolving an already-cleared issue is a no-op — no premature flip', async () => {
    const hold = makeHold('h-1', 'v-1', { holdTypes: ['damage', 'mechanical'], resolvedTypes: ['mechanical'] });
    const d = deps([hold]);

    await makeMarkIssueRepaired(d)('h-1', 'mechanical');             // already resolved

    expect(fromCalls).toEqual(['holds']);                            // stays intermediate
    expect(chain.update).toHaveBeenCalledWith({ resolved_types: ['mechanical'] });
    expect(d.setAllVehicles).not.toHaveBeenCalled();                 // damage still open → no flip
  });

  it('linked-exception auto-close fires only on the whole-hold flip, not a partial', async () => {
    const linked = makeHold('h-orig', 'v-1', {
      status: 'RELEASED',
      release: { id: 'r-1', holdId: 'h-orig', approvedById: 'mgr', approvedAt: '2026-06-10T00:00:00.000Z',
        releaseType: 'EXCEPTION', releaseMethod: 'standard', reason: '', notes: '' },
    });
    const reHold = makeHold('h-1', 'v-1', { holdTypes: ['damage', 'mechanical'], linkedHoldId: 'h-orig' });

    // Partial resolution → no linked close (no releases write).
    await makeMarkIssueRepaired(deps([reHold, linked]))('h-1', 'mechanical');
    expect(fromCalls).not.toContain('releases');

    // Final flip → finalize closes the linked open exception.
    fromCalls.length = 0;
    const reHoldNext = { ...reHold, resolvedTypes: ['mechanical'] as HoldType[] };
    await makeMarkIssueRepaired(deps([reHoldNext, linked]))('h-1', 'damage', REPAIR);
    expect(fromCalls).toContain('releases');
  });
});
