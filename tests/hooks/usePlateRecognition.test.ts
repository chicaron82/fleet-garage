import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { KnownPlate } from '../../src/lib/vehicleByPlate';

const resolveMock = vi.fn();
vi.mock('../../src/hooks/useVehicleByPlate', () => ({
  useVehicleByPlate: () => ({ resolve: resolveMock, remember: vi.fn() }),
}));

import { usePlateRecognition } from '../../src/hooks/usePlateRecognition';

const KNOWN: KnownPlate = {
  source: 'registry', plate: 'LZM524',
  unitNumber: '1234567', make: 'Toyota', model: 'Camry', year: 2023, color: 'Black',
  vehicleId: null, registryId: 'r1',
};

describe('usePlateRecognition', () => {
  beforeEach(() => { resolveMock.mockReset(); });

  it('does not query for short/empty plates and stays null', async () => {
    resolveMock.mockResolvedValue(KNOWN);
    const { result } = renderHook(({ p }: { p: string }) => usePlateRecognition(p), { initialProps: { p: 'AB' } });
    await waitFor(() => expect(result.current).toBeNull());
    expect(resolveMock).not.toHaveBeenCalled();
  });

  it('resolves a long-enough plate and returns the match', async () => {
    resolveMock.mockResolvedValue(KNOWN);
    const { result } = renderHook(({ p }: { p: string }) => usePlateRecognition(p), { initialProps: { p: 'LZM524' } });
    await waitFor(() => expect(result.current).toEqual(KNOWN));
    expect(resolveMock).toHaveBeenCalledWith('LZM524');
  });

  it('clears the match when the plate is shortened again', async () => {
    resolveMock.mockResolvedValue(KNOWN);
    const { result, rerender } = renderHook(
      ({ p }: { p: string }) => usePlateRecognition(p),
      { initialProps: { p: 'LZM524' } },
    );
    await waitFor(() => expect(result.current).toEqual(KNOWN));
    rerender({ p: '' });
    await waitFor(() => expect(result.current).toBeNull());
  });

  it('fires onResolved with the resolved match (for field pre-fill)', async () => {
    resolveMock.mockResolvedValue(KNOWN);
    const onResolved = vi.fn();
    renderHook(({ p }: { p: string }) => usePlateRecognition(p, onResolved), { initialProps: { p: 'LZM524' } });
    await waitFor(() => expect(onResolved).toHaveBeenCalledWith(KNOWN));
  });
});
