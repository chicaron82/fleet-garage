// Reproduction: scanning a key tag → "Start trip" while ALREADY on the Movement
// Log must re-seed the plate field (found broken on the lot 2026-07-21, Aaron
// scanned LZM531 → Start trip → landed on Movement Log with an empty field).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { detectSpy } = vi.hoisted(() => ({ detectSpy: vi.fn() }));

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn() }));
vi.mock('../../src/lib/vsaTripWrite', () => ({ writeOrEnqueue: vi.fn() }));
vi.mock('../../src/lib/garage-uploads', () => ({ pushNotification: vi.fn() }));
vi.mock('../../src/lib/ev-detection', () => ({ detectTeslaByPlate: detectSpy }));
vi.mock('../../src/hooks/useInProgressRecovery', () => ({ useInProgressRecovery: vi.fn() }));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', employeeId: 'E1', name: 'Test', role: 'VSA', branchId: 'YWG' } }),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ shuttlePlate: '' }),
}));
vi.mock('../../src/context/ActiveSessionsContext', () => ({
  useActiveSessions: () => ({ refresh: vi.fn() }),
}));

import { useTripLifecycle } from '../../src/hooks/useTripLifecycle';

beforeEach(() => {
  detectSpy.mockResolvedValue({ isTesla: false, lastCable: null, lastAdapter: null });
});

describe('useTripLifecycle — scan-router plate re-seed', () => {
  it('re-seeds vehiclePlate when a scan arrives after mount (already on Movement Log)', () => {
    const { result, rerender } = renderHook(
      ({ plate, nonce }) => useTripLifecycle({ initialPlate: plate, initialPlateNonce: nonce }),
      { initialProps: { plate: undefined as string | undefined, nonce: undefined as number | undefined } },
    );
    expect(result.current.vehiclePlate).toBe('');

    // Scan LZM531 → "Start trip" navigates movement-log → movement-log w/ prefill + nonce.
    rerender({ plate: 'LZM531', nonce: 1 });
    expect(result.current.vehiclePlate).toBe('LZM531');
  });

  it('re-seeds a SECOND scan of the SAME plate after the operator reset the form (the 2026-07-21 bug)', () => {
    const { result, rerender } = renderHook(
      ({ plate, nonce }) => useTripLifecycle({ initialPlate: plate, initialPlateNonce: nonce }),
      { initialProps: { plate: 'LZM531' as string | undefined, nonce: 1 as number | undefined } },
    );
    expect(result.current.vehiclePlate).toBe('LZM531');

    // Operator resets, then scans the SAME tag again — new scan = new nonce, so it must re-fill
    // even though the plate string is identical.
    act(() => result.current.handleReset());
    expect(result.current.vehiclePlate).toBe('');
    rerender({ plate: 'LZM531', nonce: 2 });
    expect(result.current.vehiclePlate).toBe('LZM531');
  });

  it('does NOT clobber a plate the operator typed himself (no scan = no nonce)', () => {
    const { result, rerender } = renderHook(
      ({ plate, nonce }) => useTripLifecycle({ initialPlate: plate, initialPlateNonce: nonce }),
      { initialProps: { plate: undefined as string | undefined, nonce: undefined as number | undefined } },
    );
    act(() => result.current.setVehiclePlate('TYPED99'));
    // A plain re-render (no new scan) must leave the typed value alone.
    rerender({ plate: undefined, nonce: undefined });
    expect(result.current.vehiclePlate).toBe('TYPED99');
  });
});
