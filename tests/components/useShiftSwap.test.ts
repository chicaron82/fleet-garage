import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ShiftWithUser } from '../../src/types';

const updateShiftSpy = vi.fn();
const createShiftSpy = vi.fn();
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({ updateShift: updateShiftSpy, createShift: createShiftSpy }),
}));

import { useShiftSwap } from '../../src/components/schedule/useShiftSwap';

const mk = (over: Partial<ShiftWithUser>): ShiftWithUser => ({
  id: 'x', userId: 'u', date: '2026-06-27', shiftType: 'closing',
  startTime: '16:00', endTime: '23:00', createdAt: '', updatedAt: '', branchId: 'YWG',
  user: { name: 'Ghost', role: 'VSA' }, ...over,
});

const opener = mk({ id: 'a', userId: 'ua', shiftType: 'opening', startTime: '06:45', endTime: '15:15' });
const closer = mk({ id: 'b', userId: 'ub', shiftType: 'closing', startTime: '16:00', endTime: '23:00' });

beforeEach(() => { updateShiftSpy.mockReset(); createShiftSpy.mockReset(); });

describe('useShiftSwap.swap', () => {
  it('trades content on the happy path (two writes only)', async () => {
    updateShiftSpy.mockResolvedValue(undefined);
    const { result } = renderHook(() => useShiftSwap());
    await act(async () => { await result.current.swap(opener, closer); });

    expect(updateShiftSpy).toHaveBeenCalledTimes(2);
    // leg 1: opener's row takes the closer's content
    expect(updateShiftSpy).toHaveBeenNthCalledWith(1, 'a', expect.objectContaining({ shiftType: 'closing', startTime: '16:00', endTime: '23:00' }));
    // leg 2: closer's row takes the opener's content
    expect(updateShiftSpy).toHaveBeenNthCalledWith(2, 'b', expect.objectContaining({ shiftType: 'opening', startTime: '06:45', endTime: '15:15' }));
  });

  it('restores BOTH rows when leg 2 fails after a partial write (no half-swap)', async () => {
    // leg1 ok, leg2 throws (e.g. a post-write hiccup), both restores ok
    updateShiftSpy
      .mockResolvedValueOnce(undefined)            // leg 1
      .mockRejectedValueOnce(new Error('hiccup'))  // leg 2
      .mockResolvedValue(undefined);               // restores
    const { result } = renderHook(() => useShiftSwap());

    await expect(act(async () => { await result.current.swap(opener, closer); })).rejects.toThrow('hiccup');

    expect(updateShiftSpy).toHaveBeenCalledTimes(4);
    // restore A (opener) to its original opening — NOT left as the swapped closing
    expect(updateShiftSpy).toHaveBeenNthCalledWith(3, 'a', expect.objectContaining({ shiftType: 'opening', startTime: '06:45', endTime: '15:15' }));
    // restore B (closer) to its original closing — the leg that may have written before throwing
    expect(updateShiftSpy).toHaveBeenNthCalledWith(4, 'b', expect.objectContaining({ shiftType: 'closing', startTime: '16:00', endTime: '23:00' }));
  });
});
