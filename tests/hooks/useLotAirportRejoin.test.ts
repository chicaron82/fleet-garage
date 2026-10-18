// Aaron's airplane-mode test, 2026-10-18: his queued tap landed, My Day showed it, and the top bar's squares (mounted
// the whole time) stayed hollow: the push went out while their socket was still rejoining. A reader must re-read on
// rejoin, on `online`, and when this phone's own tap is saved.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AIRPORT_WRITTEN_EVENT } from '../../src/lib/lotAirport';

const row = (cleans: number | null) => ({ data: { cleans, cleans_by: 'AS', cleans_at: '2026-10-18T18:03:00Z', returns: null, returns_by: null, returns_at: null, aisle: false, aisle_by: null, aisle_at: null }, error: null });
let current = row(null);
const reads = vi.fn(async () => current);
let onStatus: (s: string) => void = () => {};
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: reads }) }) }),
    channel: () => {
      const ch = { on: () => ch, subscribe: (cb: (s: string) => void) => { onStatus = cb; return ch; } };
      return ch;
    },
    removeChannel: vi.fn(),
  },
}));
const { useLotAirport } = await import('../../src/hooks/useLotAirport');

beforeEach(() => { current = row(null); reads.mockClear(); });

describe('useLotAirport — never stuck on a push it missed', () => {
  it('⭐ the channel rejoining after a drop re-reads the row (the first join does not double-read)', async () => {
    const { result } = renderHook(() => useLotAirport('t-rejoin'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    act(() => onStatus('SUBSCRIBED'));
    expect(reads).toHaveBeenCalledTimes(1);
    current = row(1);
    act(() => onStatus('SUBSCRIBED'));
    await waitFor(() => expect(result.current.readings.cleans).toBe(1));
  });

  it('the phone coming back online re-reads', async () => {
    const { result } = renderHook(() => useLotAirport('t-online'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    current = row(1);
    act(() => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(result.current.readings.cleans).toBe(1));
  });

  it('⭐ this phone saving a tap makes every reader on it re-read (the top bar included)', async () => {
    const { result } = renderHook(() => useLotAirport('t-written'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    current = row(1);
    act(() => { window.dispatchEvent(new Event(AIRPORT_WRITTEN_EVENT)); });
    await waitFor(() => expect(result.current.readings.cleans).toBe(1));
  });
});
