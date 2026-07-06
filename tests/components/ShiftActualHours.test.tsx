import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShiftWithUser } from '../../src/types';
import type { ActualHours } from '../../src/hooks/useActualHours';

// The behaviour worth locking: "Clear saved hours" is the only path that nulls
// actual hours back out, and it deliberately routes around the "log as scheduled"
// default by calling logActualHours with empty strings. A silent regression here
// (e.g. re-adding a non-empty guard to the clear path) would strand a mis-logged
// shift's hours forever — exactly the bug the feature fixed. The fields are now
// always visible (no collapse toggle) and the Save moved up to FlipShiftSheet, so
// this component only owns the fields render + the clear.

const logActualHoursSpy = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({ logActualHours: logActualHoursSpy }),
}));

import { ShiftActualHours } from '../../src/components/schedule/ShiftActualHours';

const baseShift: ShiftWithUser = {
  id: 'shift-1', userId: 'u1', date: '2026-06-07', shiftType: 'closing',
  startTime: '09:00', endTime: '17:00', createdAt: '2026-06-07T00:00:00Z',
  updatedAt: '2026-06-07T00:00:00Z', branchId: 'YWG',
  user: { name: 'Aaron S.', role: 'VSA' },
};
const savedShift: ShiftWithUser = { ...baseShift, actualStartTime: '08:57', actualEndTime: '11:00' };

/** A plain ActualHours stub — the parent's useActualHours owns the real state; this
 *  component just renders from it, so a literal is enough to exercise the clear path. */
function stubActual(start = '', end = ''): ActualHours {
  return {
    actualStart: start, actualEnd: end, isStat: false,
    setActualStart: vi.fn(), setActualEnd: vi.fn(), setIsStat: vi.fn(),
    syncToScheduled: vi.fn(),
    netHrs: 0, previewOT: 0, breakDeducted: false,
  };
}

beforeEach(() => {
  logActualHoursSpy.mockClear();
  logActualHoursSpy.mockResolvedValue(undefined);
});

describe('ShiftActualHours — clear saved hours', () => {
  it('clears saved hours by calling logActualHours with empty strings (routes around the log-as-scheduled default)', async () => {
    const onClose = vi.fn();
    render(<ShiftActualHours shift={savedShift} actual={stubActual('08:57', '11:00')} onClose={onClose} />);

    // Fields are always visible now — the clear affordance is present for a saved shift.
    await userEvent.click(screen.getByRole('button', { name: /clear saved hours/i }));
    expect(screen.getByText(/clear saved actual hours\?/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^clear hours$/i }));

    expect(logActualHoursSpy).toHaveBeenCalledWith('shift-1', '', '', false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not offer the clear affordance when no actual hours are saved', () => {
    render(<ShiftActualHours shift={baseShift} actual={stubActual()} onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /clear saved hours/i })).not.toBeInTheDocument();
  });

  it('cancels the clear without calling logActualHours', async () => {
    render(<ShiftActualHours shift={savedShift} actual={stubActual('08:57', '11:00')} onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /clear saved hours/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/clear saved actual hours\?/i)).not.toBeInTheDocument();
    expect(logActualHoursSpy).not.toHaveBeenCalled();
  });
});
