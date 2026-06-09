import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShiftWithUser } from '../../src/types';

// The behaviour worth locking: "Clear saved hours" is the only path that nulls
// actual hours back out, and it deliberately routes around the Log-Hours
// non-empty guard by calling logActualHours with empty strings. A silent
// regression here (e.g. re-adding the guard to the clear path) would strand a
// mis-logged shift's hours forever — exactly the bug the feature fixed.

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

beforeEach(() => {
  logActualHoursSpy.mockClear();
  logActualHoursSpy.mockResolvedValue(undefined);
});

describe('ShiftActualHours — clear saved hours', () => {
  it('clears saved hours by calling logActualHours with empty strings (routes around the non-empty guard)', async () => {
    const onClose = vi.fn();
    render(<ShiftActualHours shift={savedShift} shiftType="closing" onClose={onClose} />);

    // A saved shift opens with the "Edit actual hours" toggle.
    await userEvent.click(screen.getByRole('button', { name: /edit actual hours/i }));

    // The clear affordance is present; tapping it raises the two-step confirm.
    await userEvent.click(screen.getByRole('button', { name: /clear saved hours/i }));
    expect(screen.getByText(/clear saved actual hours\?/i)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /^clear hours$/i }));

    expect(logActualHoursSpy).toHaveBeenCalledWith('shift-1', '', '', false);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('does not offer the clear affordance when no actual hours are saved', async () => {
    render(<ShiftActualHours shift={baseShift} shiftType="closing" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /log actual hours/i }));

    expect(screen.queryByRole('button', { name: /clear saved hours/i })).not.toBeInTheDocument();
    // The normal Log-Hours submit guard is still present (disabled on empty fields).
    expect(screen.getByRole('button', { name: /log hours/i })).toBeDisabled();
  });

  it('cancels the clear without calling logActualHours', async () => {
    render(<ShiftActualHours shift={savedShift} shiftType="closing" onClose={vi.fn()} />);

    await userEvent.click(screen.getByRole('button', { name: /edit actual hours/i }));
    await userEvent.click(screen.getByRole('button', { name: /clear saved hours/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(screen.queryByText(/clear saved actual hours\?/i)).not.toBeInTheDocument();
    expect(logActualHoursSpy).not.toHaveBeenCalled();
  });
});
