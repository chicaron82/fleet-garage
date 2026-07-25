import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ShiftWithUser } from '../../src/types';

// The hook now calls atomic Postgres RPCs (migration 107) instead of two client
// writes, so we assert the RPC name + args and the follow-up refresh(). writeWithRefresh
// is passed through to its thunk so the rpc result surfaces unchanged.
const rpcSpy = vi.fn();
const refreshSpy = vi.fn();
vi.mock('../../src/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcSpy(...args) },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({ refresh: refreshSpy }),
}));

import { useShiftSwap } from '../../src/components/schedule/useShiftSwap';

const mk = (over: Partial<ShiftWithUser>): ShiftWithUser => ({
  id: 'x', userId: 'u', date: '2026-06-27', shiftType: 'closing',
  startTime: '16:00', endTime: '23:00', createdAt: '', updatedAt: '', branchId: 'YWG',
  user: { name: 'Ghost', role: 'VSA' }, ...over,
});

const opener = mk({ id: 'a', userId: 'ua', shiftType: 'opening', startTime: '06:45', endTime: '15:15' });
const closer = mk({ id: 'b', userId: 'ub', shiftType: 'closing', startTime: '16:00', endTime: '23:00' });
const dayOff = mk({ id: 'c', userId: 'uc', shiftType: 'day-off', startTime: undefined, endTime: undefined });

beforeEach(() => { rpcSpy.mockReset(); refreshSpy.mockReset(); rpcSpy.mockResolvedValue({ data: [], error: null }); });

describe('useShiftSwap.swap', () => {
  it('swaps atomically through one RPC call, then refreshes', async () => {
    const { result } = renderHook(() => useShiftSwap());
    await act(async () => { await result.current.swap(opener, closer, '  traded  '); });

    expect(rpcSpy).toHaveBeenCalledTimes(1);
    expect(rpcSpy).toHaveBeenCalledWith('swap_shift_content', { p_a_id: 'a', p_b_id: 'b', p_note: 'traded' });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('swapping an on-shift with a day-off is one call (the Rey↔Robert case) — no half-swap path', async () => {
    const { result } = renderHook(() => useShiftSwap());
    await act(async () => { await result.current.swap(opener, dayOff); });
    // Empty note collapses to undefined so the SQL default (clear) applies.
    expect(rpcSpy).toHaveBeenCalledWith('swap_shift_content', { p_a_id: 'a', p_b_id: 'c', p_note: undefined });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('does not refresh when the RPC errors, and still clears busy', async () => {
    rpcSpy.mockResolvedValue({ data: null, error: new Error('rpc failed') });
    const { result } = renderHook(() => useShiftSwap());
    await expect(act(async () => { await result.current.swap(opener, closer); })).rejects.toThrow('rpc failed');
    expect(refreshSpy).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(false);
  });
});

describe('useShiftSwap.giveAway', () => {
  it('passes the taker existing shift id when they have one', async () => {
    const { result } = renderHook(() => useShiftSwap());
    await act(async () => { await result.current.giveAway(closer, 'uc', dayOff, 'covering'); });
    expect(rpcSpy).toHaveBeenCalledWith('give_away_shift', {
      p_giver_id: 'b', p_taker_id: 'uc', p_taker_shift_id: 'c', p_note: 'covering',
    });
    expect(refreshSpy).toHaveBeenCalledTimes(1);
  });

  it('omits the taker shift id when they have no same-day shift (new row created server-side)', async () => {
    const { result } = renderHook(() => useShiftSwap());
    await act(async () => { await result.current.giveAway(closer, 'unew', null); });
    expect(rpcSpy).toHaveBeenCalledWith('give_away_shift', {
      p_giver_id: 'b', p_taker_id: 'unew', p_taker_shift_id: undefined, p_note: undefined,
    });
  });
});
