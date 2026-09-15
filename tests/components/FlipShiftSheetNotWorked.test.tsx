import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ShiftWithUser } from '../../src/types';

// ⚠️ THE SEAM THAT SHIPPED THE PHANTOM OT (Aaron's sick day, 2026-09-14). An unlogged MID flipped to
// Sick saved its schedule as hours WORKED, and calcOT paid all of them as overtime. The hook test pins
// the reset; this pins what the Save actually hands to the database.
const logActualHours = vi.fn().mockResolvedValue(undefined);
const updateShift = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/context/ScheduleContext', () => ({
  useSchedule: () => ({ updateShift, logActualHours, deleteShift: vi.fn(), setPtoApproved: vi.fn(), isPeakSeason: true }),
}));

import { FlipShiftSheet } from '../../src/components/schedule/FlipShiftSheet';
import { toISO } from '../../src/lib/schedule-helpers';

// ⚠️⚠️ LOCAL "today", from the component's OWN helper — never `toISOString().slice(0, 10)`.
// That is the UTC date, and at 19:00 in Winnipeg UTC has already rolled to tomorrow: the test built a
// shift dated tomorrow, FlipShiftSheet (`shift.date <= toISO(new Date())`) correctly treated it as a
// future shift with no actual hours, and all four cases failed — every evening from 19:00 to midnight,
// green all day. Found 2026-09-14 at 19:10, an hour after it passed a full-suite run. Two definitions of
// "today" is the same defect as the midnight shift validator the night before.
const today = toISO(new Date());
const mid: ShiftWithUser = {
  id: 's1', userId: 'u1', date: today, shiftType: 'mid', startTime: '09:30', endTime: '18:00',
  createdAt: '', updatedAt: '', branchId: 'YWG', user: { name: 'Aaron S.', role: 'VSA' },
};

beforeEach(() => { logActualHours.mockClear(); updateShift.mockClear(); });

describe('FlipShiftSheet — a day flipped to not worked', () => {
  it('⭐ an unlogged shift flipped to Sick saves NO actual hours', async () => {
    render(<FlipShiftSheet shift={mid} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sick' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateShift).toHaveBeenCalledWith('s1', expect.objectContaining({ shiftType: 'sick' })));
    expect(logActualHours).toHaveBeenCalledWith('s1', '', '', expect.any(Boolean));
  });

  it('the same for PTO — it is the same trap', async () => {
    render(<FlipShiftSheet shift={mid} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'PTO' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(logActualHours).toHaveBeenCalledWith('s1', '', '', expect.any(Boolean)));
  });

  it('⚠️ hours already LOGGED survive the flip — the called-in-on-a-day-off case', async () => {
    render(<FlipShiftSheet shift={{ ...mid, actualStartTime: '09:30', actualEndTime: '12:00' }} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sick' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(logActualHours).toHaveBeenCalledWith('s1', '09:30', '12:00', expect.any(Boolean)));
  });

  it('a working day saved untouched still logs "as scheduled"', async () => {
    render(<FlipShiftSheet shift={mid} onClose={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(logActualHours).toHaveBeenCalledWith('s1', '09:30', '18:00', expect.any(Boolean)));
  });
});
