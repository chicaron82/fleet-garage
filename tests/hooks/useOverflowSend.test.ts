import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { Vehicle } from '../../src/types';
import type { KeytagRead } from '../../api/_lib/keytagRead';

// ── The three seams this hook reaches through ────────────────────────────────
const readKeytag = vi.fn<(b: string) => Promise<KeytagRead | null>>();
const addVehicle = vi.fn();
const updateVehicleFields = vi.fn();
const attachKeytagPhotoIfMissing = vi.fn();
let FLEET: Vehicle[] = [];

vi.mock('../../src/hooks/useKeytagRead', () => ({
  useKeytagRead: () => ({ readKeytag, status: 'idle' }),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles: FLEET, addVehicle, updateVehicleFields, attachKeytagPhotoIfMissing,
  }),
}));
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', branchId: 'YWG' } }),
}));
vi.mock('../../src/lib/vsaTripWrite', () => ({
  writeOrEnqueue: vi.fn(async () => ({ ok: true })),
}));

import { useOverflowSend } from '../../src/hooks/useOverflowSend';

const car = (o: Partial<Vehicle> & { licensePlate: string }): Vehicle => ({
  id: `v-${o.licensePlate}`, unitNumber: null, make: '', model: '', year: 0, color: '',
  status: 'CLEAR', branchId: 'YWG', isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
  ...o,
} as Vehicle);

const NEW_READ: KeytagRead = {
  plate: 'LUR900', unitNumber: '5429000', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White',
};

beforeEach(() => {
  vi.clearAllMocks();
  FLEET = [];
  addVehicle.mockResolvedValue('v-minted');
  updateVehicleFields.mockResolvedValue(undefined);
  attachKeytagPhotoIfMissing.mockResolvedValue(undefined);
});

// ⭐ Aaron, 2026-09-08: "i went for the chat because I could send multiple in one go."
// The chat's tool keeps only the plate. This form kept everything but took one photo at a time,
// so the batch route was the lossy one and he had no way to know.
describe('useOverflowSend — a stack of key tags', () => {
  it('stages one send per photo', async () => {
    FLEET = [car({ licensePlate: 'LUR242', unitNumber: '5424874', make: 'Nissan', model: 'Versa', year: 2025 })];
    readKeytag
      .mockResolvedValueOnce({ plate: 'LUR242', unitNumber: '5424874' })
      .mockResolvedValueOnce({ plate: 'LUR242', unitNumber: '5424874' });
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos(['a', 'b']); });
    expect(result.current.sends).toHaveLength(2);
  });

  it('⚠️⚠️ TWO TAGS FOR THE SAME NEW CAR REGISTER IT ONCE — the stale-closure trap', async () => {
    // `vehicles` is captured when the callback is built. Planning every photo against that
    // snapshot would resolve BOTH of these as "new" and mint the car twice. The batch threads a
    // growing `known` list instead, so photo #2 sees what photo #1 created.
    readKeytag.mockResolvedValue(NEW_READ);
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos(['a', 'b']); });
    expect(addVehicle).toHaveBeenCalledTimes(1);
    expect(result.current.sends).toHaveLength(2);
  });

  it('reports progress while it runs and clears it after', async () => {
    readKeytag.mockResolvedValue({ plate: 'LUR242' });
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos(['a', 'b', 'c']); });
    expect(result.current.scanProgress).toBeNull();
    expect(result.current.sends).toHaveLength(3);
  });

  it('⭐ keeps the tag photo for every car in the stack', async () => {
    FLEET = [car({ licensePlate: 'LUR242', unitNumber: '5424874', make: 'Nissan', model: 'Versa', year: 2025 })];
    readKeytag.mockResolvedValue({ plate: 'LUR242', unitNumber: '5424874' });
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos(['photo-1', 'photo-2']); });
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-LUR242', 'photo-1');
    expect(attachKeytagPhotoIfMissing).toHaveBeenCalledWith('v-LUR242', 'photo-2');
  });

  it('an unreadable photo does not abort the rest of the stack', async () => {
    FLEET = [car({ licensePlate: 'LUR242', unitNumber: '5424874', make: 'Nissan', model: 'Versa', year: 2025 })];
    readKeytag
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ plate: 'LUR242', unitNumber: '5424874' });
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos(['bad', 'good']); });
    expect(result.current.sends).toHaveLength(1);
    expect(result.current.err).not.toBe('');
  });

  it('an empty stack is a no-op', async () => {
    const { result } = renderHook(() => useOverflowSend());
    await act(async () => { await result.current.scanPhotos([]); });
    expect(result.current.sends).toHaveLength(0);
    expect(readKeytag).not.toHaveBeenCalled();
  });
});
