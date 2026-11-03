// A trip takes a clean off Erin St; its Reset gives back only what it took (Aaron, 2026-11-03: *"Making a trip to the
// airport automatically removes 1 clean from the count"*; docs/ticket-bay-on-deck-trip-clean-quick-holds.md).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const { post, write } = vi.hoisted(() => ({
  post: vi.fn(async (_b: Record<string, unknown>) => ({ ok: true, status: 200, json: {} }) as { ok: boolean; status: number; error?: string; json: Record<string, unknown> }),
  write: vi.fn(async (..._a: unknown[]) => ({ ok: true })),
}));
vi.mock('../../src/hooks/useLotPin', () => ({ postLotSignedIn: (b: Record<string, unknown>) => post(b) }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn() }));
vi.mock('../../src/lib/vsaTripWrite', () => ({ writeOrEnqueue: (...a: unknown[]) => write(...a) }));
vi.mock('../../src/lib/garage-uploads', () => ({ pushNotification: vi.fn() }));
vi.mock('../../src/lib/ev-detection', () => ({ detectTeslaByPlate: vi.fn(async () => ({ isTesla: false })) }));
vi.mock('../../src/hooks/useInProgressRecovery', () => ({ useInProgressRecovery: vi.fn() }));
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', employeeId: 'E1', name: 'Aaron Sauddin', role: 'VSA', branchId: 'YWG' } }),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ shuttlePlate: 'SHUTTLE1' }) }));
vi.mock('../../src/context/ActiveSessionsContext', () => ({ useActiveSessions: () => ({ refresh: vi.fn() }) }));

import { useTripTakesClean } from '../../src/hooks/useTripTakesClean';
import { useTripLifecycle } from '../../src/hooks/useTripLifecycle';

// A real memory for this file: against a mock that forgets, "gave nothing back" would pass for the wrong reason.
let store: Record<string, string> = {};
beforeEach(() => {
  store = {};
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
  });
  post.mockReset();
  post.mockImplementation(async () => ({ ok: true, status: 200, json: {} }));
  write.mockClear();
});

const deltas = () => post.mock.calls.map(([b]) => (b as { action: string; delta: number }).action === 'tripClean' ? (b as { delta: number }).delta : null);

describe('useTripTakesClean', () => {
  it('⭐ take sends one −1, remembers the trip, and says so; giveBack sends the +1 and forgets it', async () => {
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-1'));
    expect(post).toHaveBeenCalledWith({ action: 'tripClean', delta: -1, by: 'AS' });
    expect(JSON.parse(store['fg.tripsThatTookAClean'])).toEqual(['trip-1']);
    expect(result.current.note).toEqual({ text: '1 clean off Erin St', tone: 'success' });
    await act(() => result.current.giveBack('trip-1'));
    expect(deltas()).toEqual([-1, 1]);
    expect(JSON.parse(store['fg.tripsThatTookAClean'])).toEqual([]);
  });

  it('⚠️ a trip that took nothing (0 cleans) gives nothing back', async () => {
    post.mockImplementationOnce(async () => ({ ok: false, status: 409, error: 'Erin St was already at 0 cleans.', json: {} }));
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-0'));
    expect(result.current.note).toEqual({ text: 'Trip started. Erin St was already at 0 cleans.', tone: 'notice' });
    await act(() => result.current.giveBack('trip-0'));
    expect(deltas()).toEqual([-1]);
  });

  it('no signal: the note says the count did not move, and a Reset invents nothing', async () => {
    post.mockImplementationOnce(async () => ({ ok: false, status: 0, error: 'No signal. The tap did not save.', json: {} }));
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-x'));
    expect(result.current.note?.text).toMatch(/No signal, so Erin St's cleans didn't move/);
    await act(() => result.current.giveBack('trip-x'));
    expect(deltas()).toEqual([-1]);
  });
});

describe('useTripLifecycle — the trip takes the clean', () => {
  it('⭐ a trip that is not a shuttle run takes one at start, and its Reset in transit gives it back', async () => {
    const { result } = renderHook(() => useTripLifecycle({}));
    act(() => result.current.setVehiclePlate('LZM542'));
    await act(() => result.current.startTrip('ROUTINE', 'PERSONAL', ''));
    await waitFor(() => expect(deltas()).toEqual([-1]));
    expect(result.current.tripState).toBe('in_transit');
    act(() => result.current.handleReset());
    await waitFor(() => expect(deltas()).toEqual([-1, 1]));
  });

  it('a shuttle run never touches the count, at start or on Reset', async () => {
    const { result } = renderHook(() => useTripLifecycle({}));
    act(() => result.current.handleShuttleToggle(true));
    await act(() => result.current.startTrip('ROUTINE', 'PERSONAL', ''));
    expect(result.current.tripState).toBe('in_transit');
    act(() => result.current.handleReset());
    await new Promise(r => setTimeout(r, 0));
    expect(post).not.toHaveBeenCalled();
  });

  it('a trip whose own write failed takes nothing (the trip is the thing)', async () => {
    write.mockImplementationOnce(async () => ({ ok: false }));
    const { result } = renderHook(() => useTripLifecycle({}));
    await act(() => result.current.startTrip('ROUTINE', 'PERSONAL', ''));
    expect(result.current.tripState).toBe('form');
    expect(post).not.toHaveBeenCalled();
  });
});
