import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
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

// Mirrors the hook's internal debounce window.
const DEBOUNCE_MS = 250;

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

  describe('debounce', () => {
    beforeEach(() => { vi.useFakeTimers(); });
    afterEach(() => { vi.useRealTimers(); });

    it('coalesces a burst of keystrokes into a single lookup once input settles', async () => {
      resolveMock.mockResolvedValue(KNOWN);
      const { rerender } = renderHook(
        ({ p }: { p: string }) => usePlateRecognition(p),
        { initialProps: { p: 'LZM5' } },
      );
      // Type out the rest of the plate before the debounce window elapses.
      rerender({ p: 'LZM52' });
      rerender({ p: 'LZM524' });
      expect(resolveMock).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); });

      expect(resolveMock).toHaveBeenCalledTimes(1);
      expect(resolveMock).toHaveBeenCalledWith('LZM524');
    });

    it('does not query until the debounce window elapses', async () => {
      resolveMock.mockResolvedValue(KNOWN);
      renderHook(({ p }: { p: string }) => usePlateRecognition(p), { initialProps: { p: 'LZM524' } });

      await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS - 50); });
      expect(resolveMock).not.toHaveBeenCalled();

      await act(async () => { await vi.advanceTimersByTimeAsync(50); });
      expect(resolveMock).toHaveBeenCalledTimes(1);
    });

    it('clears immediately on empty input without waiting for the debounce', async () => {
      resolveMock.mockResolvedValue(KNOWN);
      const { result, rerender } = renderHook(
        ({ p }: { p: string }) => usePlateRecognition(p),
        { initialProps: { p: 'LZM524' } },
      );
      await act(async () => { await vi.advanceTimersByTimeAsync(DEBOUNCE_MS); });
      expect(result.current).toEqual(KNOWN);

      // Emptying clears the hint on the microtask, not after another 250ms.
      await act(async () => { rerender({ p: '' }); });
      expect(result.current).toBeNull();
    });
  });
});
