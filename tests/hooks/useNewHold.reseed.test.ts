// Reproduction: scanning a key tag → "Flag / hold" must re-select the car even on a REPEAT scan
// of the same tag. Sibling of useTripLifecycle.reseed.test.ts — the hold route was the one
// scan destination left without a per-scan nonce (found by the 2026-07-22 line-check), so after
// `clearVehicle` blanked the selection, re-scanning the SAME tag no-opped and the form sat empty.
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/lib/image', () => ({ compressImage: vi.fn() }));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', employeeId: 'E1', name: 'Test', role: 'VSA', branchId: 'YWG' } }),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    vehicles: [
      { id: 'v-A', unitNumber: '111', licensePlate: 'LZM531', make: 'Kia', model: 'Carnival', year: 2026, color: 'White', status: 'CLEAR' },
      { id: 'v-B', unitNumber: '222', licensePlate: 'LUR573', make: 'Jeep', model: 'Wrangler', year: 2026, color: 'Gray', status: 'CLEAR' },
    ],
    getActiveHold: () => null,
    getActiveHolds: () => [],
    addHold: vi.fn(),
    setCoverPhoto: vi.fn(),
  }),
}));

import { useNewHold } from '../../src/hooks/useNewHold';

describe('useNewHold — scan-router vehicle re-seed', () => {
  it('selects the car when a scan arrives after mount (already on the hold form)', () => {
    const { result, rerender } = renderHook(
      ({ id, nonce }) => useNewHold(id, nonce),
      { initialProps: { id: undefined as string | undefined, nonce: undefined as number | undefined } },
    );
    expect(result.current.selectedVehicle).toBeNull();

    rerender({ id: 'v-A', nonce: 1 });
    expect(result.current.selectedVehicle?.id).toBe('v-A');
  });

  it('re-selects on a SECOND scan of the SAME car after clearVehicle (the line-check bug)', () => {
    const { result, rerender } = renderHook(
      ({ id, nonce }) => useNewHold(id, nonce),
      { initialProps: { id: 'v-A' as string | undefined, nonce: 1 as number | undefined } },
    );
    expect(result.current.selectedVehicle?.id).toBe('v-A');

    // Operator taps the ✕ to change vehicle, then re-scans the SAME tag. The routed vehicleId is
    // identical, so only a fresh nonce can distinguish it as a new scan event.
    act(() => result.current.clearVehicle());
    expect(result.current.selectedVehicle).toBeNull();

    rerender({ id: 'v-A', nonce: 2 });
    expect(result.current.selectedVehicle?.id).toBe('v-A');
  });

  it('still switches cars on a scan of a DIFFERENT vehicle', () => {
    const { result, rerender } = renderHook(
      ({ id, nonce }) => useNewHold(id, nonce),
      { initialProps: { id: 'v-A' as string | undefined, nonce: 1 as number | undefined } },
    );
    rerender({ id: 'v-B', nonce: 2 });
    expect(result.current.selectedVehicle?.id).toBe('v-B');
  });

  it('honours a non-scan navigation (vehicle screen → Flag), which carries NO nonce', () => {
    const { result, rerender } = renderHook(
      ({ id, nonce }) => useNewHold(id, nonce),
      { initialProps: { id: undefined as string | undefined, nonce: undefined as number | undefined } },
    );
    // No nonce on this route — the value-keyed re-seed is what must carry it.
    rerender({ id: 'v-B', nonce: undefined });
    expect(result.current.selectedVehicle?.id).toBe('v-B');
  });

  it('does NOT clobber a car the operator picked himself (no scan = no nonce)', () => {
    const { result, rerender } = renderHook(
      ({ id, nonce }) => useNewHold(id, nonce),
      { initialProps: { id: undefined as string | undefined, nonce: undefined as number | undefined } },
    );
    act(() => result.current.selectVehicle('v-B'));
    expect(result.current.selectedVehicle?.id).toBe('v-B');

    rerender({ id: undefined, nonce: undefined });
    expect(result.current.selectedVehicle?.id).toBe('v-B');
  });
});
