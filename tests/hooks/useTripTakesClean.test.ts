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

const deltas = () => post.mock.calls.filter(([b]) => (b as { action: string }).action === 'tripClean').map(([b]) => (b as { delta: number }).delta);
const calls = (action: string) => post.mock.calls.map(([b]) => b as Record<string, unknown>).filter(b => b.action === action);
// The server's answer to bayTripSentUp: the line it marked, or none.
const marks = (row: Record<string, unknown> | null) => post.mockImplementation(async (b: Record<string, unknown>) =>
  ({ ok: true, status: 200, json: b.action === 'bayTripSentUp' ? { row } : {} }));

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

describe('✈ the trip marks today\'s Clean (2026-11-09, docs/ticket-trip-marks-sent-up.md)', () => {
  it('⭐ take sends the plate, says the ✈, and its Reset takes back the ✈ it put on', async () => {
    marks({ id: 323, plate: 'LUR437' });
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-1', 'lur 437'));
    expect(calls('bayTripSentUp')).toEqual([{ action: 'bayTripSentUp', plate: 'lur 437', by: 'AS' }]);
    expect(result.current.note).toEqual({ text: '1 clean off Erin St · ✈ LUR437 sent up', tone: 'success' });
    await act(() => result.current.giveBack('trip-1'));
    expect(calls('baySentUp')).toEqual([{ action: 'baySentUp', id: 323, sent: false, by: 'AS' }]);
    expect(deltas()).toEqual([-1, 1]);
    expect(result.current.note?.text).toBe('Trip reset. The clean is back on Erin St, and ✈ is off LUR437.');
    expect(JSON.parse(store['fg.tripsThatSentUp'])).toEqual([]);
  });

  it('⭐ a car not on today\'s list (or one he marked by hand): no ✈ said, and the Reset never touches a ✈', async () => {
    marks(null);
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-2', 'LZM542'));
    expect(result.current.note?.text).toBe('1 clean off Erin St');
    await act(() => result.current.giveBack('trip-2'));
    expect(calls('baySentUp')).toEqual([]);
  });

  it('a ✈ that marked even at 0 cleans is still taken back on Reset, with no clean invented', async () => {
    post.mockImplementation(async (b: Record<string, unknown>) => b.action === 'tripClean'
      ? { ok: false, status: 409, error: 'Erin St was already at 0 cleans.', json: {} }
      : { ok: true, status: 200, json: b.action === 'bayTripSentUp' ? { row: { id: 9, plate: 'LUR437' } } : {} });
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-3', 'LUR437'));
    expect(result.current.note?.text).toBe('Trip started. Erin St was already at 0 cleans. ✈ LUR437 sent up.');
    await act(() => result.current.giveBack('trip-3'));
    expect(deltas()).toEqual([-1]);
    expect(calls('baySentUp')).toHaveLength(1);
    expect(result.current.note?.text).toBe('Trip reset. ✈ is off LUR437.');
  });

  it('a line Changed off Clean meanwhile (409 on the Reset) is quiet, and forgotten', async () => {
    marks({ id: 9, plate: 'LUR437' });
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-4', 'LUR437'));
    post.mockImplementation(async (b: Record<string, unknown>) => b.action === 'baySentUp'
      ? { ok: false, status: 409, error: 'Only a Clean goes up from the list.', json: {} }
      : { ok: true, status: 200, json: {} });
    await act(() => result.current.giveBack('trip-4'));
    expect(result.current.note?.text).toBe('Trip reset. The clean is back on Erin St.');
    expect(JSON.parse(store['fg.tripsThatSentUp'])).toEqual([]);
  });

  it('no signal: the note says the ✈ did not land either', async () => {
    post.mockImplementation(async () => ({ ok: false, status: 0, error: 'No signal. The tap did not save.', json: {} }));
    const { result } = renderHook(() => useTripTakesClean('AS'));
    await act(() => result.current.take('trip-5', 'LUR437'));
    expect(result.current.note?.text).toBe("Trip started. No signal, so Erin St's cleans didn't move. Tap −1 when you can, and ✈ on the list if it was cleaned today.");
  });
});

describe('useTripLifecycle — the trip takes the clean', () => {
  it('⭐ the trip sends its own plate for the ✈', async () => {
    const { result } = renderHook(() => useTripLifecycle({}));
    act(() => result.current.setVehiclePlate('LUR437'));
    await act(() => result.current.startTrip('ROUTINE', 'PERSONAL', ''));
    await waitFor(() => expect(calls('bayTripSentUp')).toEqual([{ action: 'bayTripSentUp', plate: 'LUR437', by: 'AS' }]));
  });

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

  it('⭐ a trip marked Other never touches the count, at start or on Reset (his ruling, 2026-11-03)', async () => {
    const { result } = renderHook(() => useTripLifecycle({}));
    act(() => result.current.setVehiclePlate('LZM542'));
    await act(() => result.current.startTrip('OTHER', 'PERSONAL', ''));
    expect(result.current.tripState).toBe('in_transit');
    act(() => result.current.handleReset());
    await new Promise(r => setTimeout(r, 0));
    expect(post).not.toHaveBeenCalled();
  });

  it.each(['COVERAGE_ASSIST', 'CODE_RED'] as const)('%s still takes one', async reason => {
    const { result } = renderHook(() => useTripLifecycle({}));
    act(() => result.current.setVehiclePlate('LZM542'));
    await act(() => result.current.startTrip(reason, 'MANAGEMENT', ''));
    await waitFor(() => expect(deltas()).toEqual([-1]));
  });

  it('a trip whose own write failed takes nothing (the trip is the thing)', async () => {
    write.mockImplementationOnce(async () => ({ ok: false }));
    const { result } = renderHook(() => useTripLifecycle({}));
    await act(() => result.current.startTrip('ROUTINE', 'PERSONAL', ''));
    expect(result.current.tripState).toBe('form');
    expect(post).not.toHaveBeenCalled();
  });
});
