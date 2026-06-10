import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ShiftCheckpoint } from '../../src/types';

// Regression: getTodayCheckpoint() resolves async from WashbayContext. Seeding a
// `collapsed` flag from it at mount froze a blank check-in form until a *second*
// refresh (which loaded the checkpoint before mount). The fix renders the
// "checked-in" view off the LIVE checkpoint + an `editing` intent, so a checkpoint
// that lands after mount flips the view immediately.

const ctx = {
  getTodayCheckpoint: vi.fn(),
  submitCheckpoint: vi.fn().mockResolvedValue(true),
  handoffNotes: [] as unknown[],
  getLatestGasSheetReading: vi.fn().mockReturnValue(null),
};
vi.mock('../../src/context/WashbayContext', () => ({
  useWashbayContext: () => ctx,
}));

import { AfternoonCheckIn } from '../../src/components/check-in/AfternoonCheckIn';

const checkpoint: ShiftCheckpoint = {
  id: 'c1', branchId: 'YWG', date: '2026-06-09', checkpointType: 'closing_arrival',
  fullPages: 0, lastPageEntries: 18, loggedBy: 'u1', loggedAt: '2026-06-09T15:00:00Z',
};

beforeEach(() => {
  ctx.getTodayCheckpoint.mockReset();
  ctx.getLatestGasSheetReading.mockReturnValue(null);
});

describe('AfternoonCheckIn', () => {
  it('shows the entry form while the checkpoint is still loading (undefined)', () => {
    ctx.getTodayCheckpoint.mockReturnValue(undefined);
    render(<AfternoonCheckIn />);
    expect(screen.getByText('Afternoon Check-In')).toBeInTheDocument();
    expect(screen.queryByText(/checked in/i)).not.toBeInTheDocument();
  });

  it('flips to the checked-in view when the checkpoint resolves after mount (regression: no frozen blank form)', () => {
    ctx.getTodayCheckpoint.mockReturnValue(undefined);
    const { rerender } = render(<AfternoonCheckIn />);
    expect(screen.getByText('Afternoon Check-In')).toBeInTheDocument();

    // The checkpoint resolves from context — the next render must read it live.
    ctx.getTodayCheckpoint.mockReturnValue(checkpoint);
    rerender(<AfternoonCheckIn />);

    expect(screen.getByText(/Checked in · Page 0 \+ 18 = 18 cars/)).toBeInTheDocument();
    expect(screen.queryByText('Afternoon Check-In')).not.toBeInTheDocument();
  });

  it('shows the checked-in view immediately when the checkpoint is already loaded at mount', () => {
    ctx.getTodayCheckpoint.mockReturnValue(checkpoint);
    render(<AfternoonCheckIn />);
    expect(screen.getByText(/Checked in/)).toBeInTheDocument();
  });
});
