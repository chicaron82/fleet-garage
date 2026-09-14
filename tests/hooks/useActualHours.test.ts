import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useActualHours } from '../../src/hooks/useActualHours';
import type { ShiftWithUser } from '../../src/types';

const base: ShiftWithUser = {
  id: 's1', userId: 'u1', date: '2026-06-07', shiftType: 'opening',
  startTime: '06:45', endTime: '15:15', createdAt: '', updatedAt: '', branchId: 'YWG',
  user: { name: 'Aaron S.', role: 'VSA' },
};

describe('useActualHours pre-fill', () => {
  it('defaults actual to the scheduled times when no hours are logged yet (no re-typing)', () => {
    const { result } = renderHook(() => useActualHours(base, 'opening'));
    expect(result.current.actualStart).toBe('06:45');
    expect(result.current.actualEnd).toBe('15:15');
  });

  it('prefers already-logged actual hours over the scheduled default', () => {
    const logged: ShiftWithUser = { ...base, actualStartTime: '06:45', actualEndTime: '15:14' };
    const { result } = renderHook(() => useActualHours(logged, 'opening'));
    expect(result.current.actualStart).toBe('06:45');
    expect(result.current.actualEnd).toBe('15:14');
  });

  it('computes net hours and OT from the actual times (8h29 − 30m break = 7h59, no OT)', () => {
    // The real case: clocked out 1 min early → 7h59 net, under the 8h OT line.
    const logged: ShiftWithUser = { ...base, actualStartTime: '06:45', actualEndTime: '15:14' };
    const { result } = renderHook(() => useActualHours(logged, 'opening'));
    expect(result.current.netHrs).toBeCloseTo(7 + 59 / 60, 5);
    expect(result.current.previewOT).toBe(0);
    expect(result.current.breakDeducted).toBe(true);
  });

  it('syncToScheduled overwrites actual with a new preset (the worked-as-scheduled default)', () => {
    const { result } = renderHook(() => useActualHours(base, 'opening'));
    act(() => result.current.syncToScheduled('13:30', '22:00'));
    expect(result.current.actualStart).toBe('13:30');
    expect(result.current.actualEnd).toBe('22:00');
  });
});

describe('useActualHours — a day flipped to NOT worked (the phantom-OT bug, 2026-09-14)', () => {
  // Aaron's own sick day: an unlogged MID flipped to sick saved 09:30–18:00 as worked, and calcOT
  // paid all 8h as overtime. Sick and PTO are both 8 REGULAR hours in calcPayEstimate — with no actuals.
  const mid: ShiftWithUser = { ...base, date: '2026-09-14', shiftType: 'mid', startTime: '09:30', endTime: '18:00' };

  it('⭐ clears the schedule-derived pre-fill, so the day saves as not worked', () => {
    const { result } = renderHook(() => useActualHours(mid, 'sick'));
    expect(result.current.actualStart).toBe('09:30'); // the pre-fill that caused it
    act(() => result.current.clearUnloggedPrefill());
    expect(result.current.actualStart).toBe('');
    expect(result.current.actualEnd).toBe('');
    expect(result.current.previewOT).toBe(0);
  });

  it('⚠️ NEVER clears hours that were really logged — the called-in-on-a-day-off case', () => {
    const logged: ShiftWithUser = { ...base, shiftType: 'day-off', startTime: undefined, endTime: undefined, actualStartTime: '10:00', actualEndTime: '14:00' };
    const { result } = renderHook(() => useActualHours(logged, 'day-off'));
    act(() => result.current.clearUnloggedPrefill());
    expect(result.current.actualStart).toBe('10:00');
    expect(result.current.actualEnd).toBe('14:00');
  });

  it('flipping back to a working type still pre-fills as scheduled', () => {
    const { result } = renderHook(() => useActualHours(mid, 'sick'));
    act(() => result.current.clearUnloggedPrefill());
    act(() => result.current.syncToScheduled('09:30', '18:00'));
    expect(result.current.actualStart).toBe('09:30');
  });
});
