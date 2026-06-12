import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ChangeEvent } from 'react';
import type { Vehicle, User } from '../../src/types';
import type { useNewHold as UseNewHold } from '../../src/hooks/useNewHold';

type HookResult = { current: ReturnType<typeof UseNewHold> };

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VSA_USER: User = {
  id: 'user-1', employeeId: 'E001', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

const VEHICLE: Vehicle = {
  id: 'v-1', unitNumber: '5500001', licensePlate: 'AAA111',
  make: 'Toyota', model: 'Corolla', year: 2024, color: 'White',
  status: 'CLEAR', branchId: 'YWG',
  isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};

// ── Mocks ────────────────────────────────────────────────────────────────────

const addHoldSpy = vi.fn().mockResolvedValue(undefined);

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: VSA_USER }),
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles:       [VEHICLE],
    getActiveHold:  () => null,
    getActiveHolds: () => [],
    addHold:        addHoldSpy,
  }),
}));

vi.mock('../../src/lib/image', () => ({
  compressImage: vi.fn().mockResolvedValue('data:image/jpeg;base64,STUB'),
}));

const importHook = async () => (await import('../../src/hooks/useNewHold')).useNewHold;

// Drives the hook to a submittable state: preselected vehicle + one damage type +
// one photo (a damage hold requires both).
async function reachCanSubmit(result: HookResult) {
  act(() => { result.current.toggleDamageType('Scratch'); });
  await act(async () => {
    await result.current.handlePhotoAdd({
      target: { files: [new File(['x'], 'd.jpg', { type: 'image/jpeg' })], value: '' },
    } as unknown as ChangeEvent<HTMLInputElement>);
  });
}

beforeEach(() => { addHoldSpy.mockClear(); });

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useNewHold — double-submit race', () => {
  it('two submit() calls fired before a re-render flag exactly one hold', async () => {
    const useNewHold = await importHook();
    const { result } = renderHook(() => useNewHold('v-1'));
    await reachCanSubmit(result);
    expect(result.current.canSubmit).toBe(true);

    // Both calls run synchronously on the same render's closure — exactly the
    // double-tap race. Without the synchronous ref lock, both pass the
    // state-derived canSubmit guard and both call addHold.
    await act(async () => {
      const a = result.current.submit();
      const b = result.current.submit();
      await Promise.all([a, b]);
    });

    expect(addHoldSpy).toHaveBeenCalledTimes(1);
  });

  it('the lock releases — a later genuine submit still flags', async () => {
    const useNewHold = await importHook();
    const { result } = renderHook(() => useNewHold('v-1'));
    await reachCanSubmit(result);

    await act(async () => { await result.current.submit(); });
    expect(addHoldSpy).toHaveBeenCalledTimes(1);

    // State isn't reset by submit (the caller navigates away on success), so a
    // second deliberate submit proceeds — proving the lock isn't a permanent latch.
    await act(async () => { await result.current.submit(); });
    expect(addHoldSpy).toHaveBeenCalledTimes(2);
  });
});
