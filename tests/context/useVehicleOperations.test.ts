// Behaviour-locking net for useVehicleOperations — the sequencing layer over
// holdResolution. Tests lock: primary-write-failure contracts (throws, no state
// flip), vehicle-status derivation, and the optimistic-state gating rule.
// Resolution-factory contracts (throw-on-failure, linked auto-close, batch guard)
// live in tests/context/holdResolution.test.ts; this file proves the hook wires
// them and covers the ops that live here directly.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Hold, Vehicle, Release } from '../../src/types';

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { writeWithRefreshMock, uploadPhotoMock, pushNotificationMock } = vi.hoisted(() => ({
  writeWithRefreshMock: vi.fn(),
  uploadPhotoMock:      vi.fn(),
  pushNotificationMock: vi.fn(),
}));

const fromCalls: string[] = [];
const chain = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  eq:     vi.fn(() => chain),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => { fromCalls.push(table); return chain; },
  },
  writeWithRefresh: (...args: unknown[]) => writeWithRefreshMock(...args),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  uploadPhoto:      (...args: unknown[]) => uploadPhotoMock(...args),
  pushNotification: (...args: unknown[]) => pushNotificationMock(...args),
}));

vi.mock('../../src/context/evAssetWrite', () => ({
  makeUpdateVehicleEVAssets: () => vi.fn(),
}));

import { useVehicleOperations } from '../../src/context/useVehicleOperations';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeVehicle(id = 'v-1'): Vehicle {
  return {
    id, unitNumber: '4916466', licensePlate: 'ABC 123',
    make: 'Toyota', model: 'RAV4', year: 2022, color: 'White',
    status: 'CLEAR', branchId: 'YWG',
    isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
  };
}

function makeHold(id = 'h-1', vehicleId = 'v-1', overrides: Partial<Hold> = {}): Hold {
  return {
    id, vehicleId,
    holdTypes: ['damage'], holdType: 'damage',
    damageDescription: 'scrape', notes: '',
    flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
    flaggedAt: '2026-06-11T08:00:00.000Z',
    status: 'ACTIVE', branchId: 'YWG',
    ...overrides,
  };
}

const EXCEPTION_RELEASE: Omit<Release, 'id'> = {
  holdId: 'h-1',
  approvedById: 'mgr-1', approvedAt: '2026-06-11T09:00:00.000Z',
  releaseType: 'EXCEPTION', releaseMethod: 'standard',
  reason: 'Operational need', notes: '',
};

const NEW_VEHICLE: Omit<Vehicle, 'id' | 'status' | 'branchId'> = {
  unitNumber: '4916466', licensePlate: 'ABC 123',
  make: 'Toyota', model: 'RAV4', year: 2022, color: 'White',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

function makeOps(holds: Hold[] = [], vehicles: Vehicle[] = []) {
  const setAllVehicles = vi.fn();
  const setAllHolds = vi.fn();
  const { result } = renderHook(() => useVehicleOperations({
    allVehicles: vehicles, holds,
    activeBranch: 'YWG', userId: 'u-1',
    userName: 'Test User', userEmployeeId: 'E001',
    setAllVehicles, setAllHolds,
  }));
  return { ops: result.current, setAllVehicles, setAllHolds };
}

function succeed() {
  return writeWithRefreshMock.mockImplementationOnce(async (fn: () => unknown) => {
    fn();
    return { error: null };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  fromCalls.length = 0;
  writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { error: null }; });
  uploadPhotoMock.mockResolvedValue('https://cdn.test/photo.jpg');
  pushNotificationMock.mockResolvedValue(undefined);
});

// ── addVehicle ────────────────────────────────────────────────────────────────

describe('addVehicle', () => {
  it('inserts into vehicles and adds to local state', async () => {
    const { ops, setAllVehicles } = makeOps();

    await ops.addVehicle(NEW_VEHICLE);

    expect(fromCalls[0]).toBe('vehicles');
    expect(setAllVehicles).toHaveBeenCalledTimes(1);
  });

  it('throws on primary-write-failure and does not update local state', async () => {
    const { ops, setAllVehicles } = makeOps();
    writeWithRefreshMock.mockResolvedValueOnce({ error: { message: 'DB down' } });

    await expect(ops.addVehicle(NEW_VEHICLE)).rejects.toThrow('Failed to add vehicle');
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
});

// ── addHold ───────────────────────────────────────────────────────────────────

describe('addHold', () => {
  it('writes hold + vehicle, updates both states', async () => {
    const v = makeVehicle();
    const { ops, setAllHolds, setAllVehicles } = makeOps([], [v]);

    await ops.addHold(v.id, 'scrape', '', 'u-1');

    expect(fromCalls[0]).toBe('holds');
    expect(fromCalls).toContain('vehicles');
    expect(setAllHolds).toHaveBeenCalledTimes(1);
    expect(setAllVehicles).toHaveBeenCalledTimes(1);
  });

  it('throws on primary-write-failure — no state flip', async () => {
    const v = makeVehicle();
    const { ops, setAllHolds, setAllVehicles } = makeOps([], [v]);
    writeWithRefreshMock.mockResolvedValueOnce({ error: { message: 'holds write failed' } });

    await expect(ops.addHold(v.id, 'scrape', '', 'u-1')).rejects.toThrow('Failed to add hold');
    expect(setAllHolds).not.toHaveBeenCalled();
    expect(setAllVehicles).not.toHaveBeenCalled();
  });

  it('hold added locally even when vehicle-write fails (gating contract)', async () => {
    // The hold insert is the source of truth. A failed vehicle-status write must
    // not prevent the hold from appearing locally — the fleet view re-derives
    // status from holds on read — but setAllVehicles must NOT fire to avoid
    // stamping a divergent status that won't self-heal (no vehicles realtime).
    const v = makeVehicle();
    const { ops, setAllHolds, setAllVehicles } = makeOps([], [v]);
    succeed(); // holds insert ✓
    writeWithRefreshMock.mockResolvedValueOnce({ error: { message: 'vehicles write failed' } });

    await ops.addHold(v.id, 'scrape', '', 'u-1');

    expect(setAllHolds).toHaveBeenCalledTimes(1);
    expect(setAllVehicles).not.toHaveBeenCalled();
  });
});

// ── addRelease ────────────────────────────────────────────────────────────────

describe('addRelease', () => {
  it('writes releases + hold + vehicle; vehicle derives ON_EXCEPTION', async () => {
    const hold = makeHold();
    const v = makeVehicle();
    const { ops, setAllHolds, setAllVehicles } = makeOps([hold], [v]);

    await ops.addRelease(hold.id, EXCEPTION_RELEASE);

    expect(fromCalls).toEqual(['releases', 'holds', 'vehicles']);
    expect(setAllHolds).toHaveBeenCalledTimes(1);
    expect(setAllVehicles).toHaveBeenCalledTimes(1);
    const updater = setAllVehicles.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    expect(updater([v])[0].status).toBe('OUT_ON_EXCEPTION');
  });

  it('throws on primary-write-failure — no state flip', async () => {
    const hold = makeHold();
    const { ops, setAllHolds, setAllVehicles } = makeOps([hold]);
    writeWithRefreshMock.mockResolvedValueOnce({ error: { message: 'releases write failed' } });

    await expect(ops.addRelease(hold.id, EXCEPTION_RELEASE)).rejects.toThrow('Failed to add release');
    expect(setAllHolds).not.toHaveBeenCalled();
    expect(setAllVehicles).not.toHaveBeenCalled();
  });

  it('throws immediately when hold is not found', async () => {
    const { ops } = makeOps([]);

    await expect(ops.addRelease('missing', EXCEPTION_RELEASE)).rejects.toThrow('Hold not found');
  });
});

// ── Resolution-ops wire smoke ─────────────────────────────────────────────────
// Factory contracts live in holdResolution.test.ts. These verify the hook
// correctly binds each factory and passes the right deps.

describe('markRepaired (wire smoke)', () => {
  it('routes to makeMarkRepaired: repairs insert → hold update → vehicle derived', async () => {
    const hold = makeHold();
    const { ops } = makeOps([hold]);

    await ops.markRepaired('h-1', {
      holdId: 'h-1', repairedById: 'mgr-1',
      repairedAt: '2026-06-11T09:00:00.000Z', notes: 'fixed', outcome: 'clean',
    });

    expect(fromCalls).toEqual(['repairs', 'holds', 'vehicles']);
  });
});

describe('markReturned (wire smoke)', () => {
  it('routes to makeMarkReturned: hold updated → release stamped → vehicle RETURNED', async () => {
    const release = { id: 'r-1', holdId: 'h-1', approvedById: 'mgr-1', approvedAt: '2026-06-11T08:00:00.000Z',
      releaseType: 'EXCEPTION' as const, releaseMethod: 'standard' as const, reason: '', notes: '' };
    const hold = makeHold('h-1', 'v-1', { status: 'RELEASED', release });
    const { ops } = makeOps([hold], [makeVehicle()]);

    await ops.markReturned('h-1');

    expect(fromCalls[0]).toBe('holds');
    expect(fromCalls).toContain('vehicles');
  });
});

// ── syncVehicleStatus ─────────────────────────────────────────────────────────

describe('syncVehicleStatus', () => {
  it('writes the correct derived status when it diverges from stored', async () => {
    // Vehicle stored as HELD; its only hold is REPAIRED → should derive CLEAR.
    const repaired = makeHold('h-1', 'v-1', { status: 'REPAIRED' });
    const v = { ...makeVehicle(), status: 'HELD' as const };
    const { ops } = makeOps([repaired], [v]);

    await ops.syncVehicleStatus('v-1');

    expect(fromCalls).toContain('vehicles');
    const written = chain.update.mock.calls.find(c => c[0]?.status)?.[0].status;
    expect(written).toBe('CLEAR');
  });

  it('is a no-op when stored status already matches derived', async () => {
    const v = makeVehicle(); // CLEAR, no holds
    const { ops } = makeOps([], [v]);

    await ops.syncVehicleStatus('v-1');

    expect(fromCalls).toEqual([]);
  });
});

// ── Vehicle management ops ────────────────────────────────────────────────────

describe('archiveVehicle', () => {
  it('writes archived_at and reflects in local state', async () => {
    const v = makeVehicle();
    const { ops, setAllVehicles } = makeOps([], [v]);

    await ops.archiveVehicle(v.id);

    expect(fromCalls).toContain('vehicles');
    const updater = setAllVehicles.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    expect(updater([v])[0].archivedAt).toBeDefined();
  });
});

describe('markVehicleEditPending', () => {
  it('flips local state only — no DB write', () => {
    const v = makeVehicle();
    const { ops, setAllVehicles } = makeOps([], [v]);

    ops.markVehicleEditPending(v.id, {
      unit: '9999', plate: 'ZZZ 999',
      by: 'Test', at: '2026-06-11T09:00:00Z', note: 'correction',
    });

    expect(fromCalls).toEqual([]);
    const updater = setAllVehicles.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    expect(updater([v])[0].editStatus).toBe('pending');
  });
});

describe('addPhotosToHold', () => {
  it('uploads photos and merges onto the hold', async () => {
    const hold = makeHold();
    const { ops, setAllHolds } = makeOps([hold]);

    await ops.addPhotosToHold(hold.id, ['data:image/png;base64,ABCD']);

    expect(fromCalls).toContain('holds');
    expect(setAllHolds).toHaveBeenCalledTimes(1);
  });
});

describe('setCoverPhoto', () => {
  it('writes cover_photo_url and reflects in local state', async () => {
    const v = makeVehicle();
    const { ops, setAllVehicles } = makeOps([], [v]);

    await ops.setCoverPhoto(v.id, 'https://cdn.test/cover.jpg');

    expect(fromCalls).toContain('vehicles');
    const updater = setAllVehicles.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    expect(updater([v])[0].coverPhotoUrl).toBe('https://cdn.test/cover.jpg');
  });
});

describe('directEditVehicleIdentity', () => {
  it('writes unit + plate and clears edit fields in local state', async () => {
    const v = { ...makeVehicle(), editStatus: 'pending' as const };
    const { ops, setAllVehicles } = makeOps([], [v]);

    await ops.directEditVehicleIdentity(v.id, '9999', 'ZZZ 999');

    expect(fromCalls).toContain('vehicles');
    const updater = setAllVehicles.mock.calls[0][0] as (prev: Vehicle[]) => Vehicle[];
    const updated = updater([v])[0];
    expect(updated.unitNumber).toBe('9999');
    expect(updated.licensePlate).toBe('ZZZ 999');
    expect(updated.editStatus).toBeNull();
  });
});
