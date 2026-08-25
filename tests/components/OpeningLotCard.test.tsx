import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { shiftDateStr } from '../../src/lib/shiftDay';

const submitWashbayLog = vi.fn().mockResolvedValue(true);
let washbayLogs: Array<Record<string, unknown>> = [];

vi.mock('../../src/context/WashbayContext', () => ({
  useWashbayContext: () => ({ washbayLogs, submitWashbayLog }),
}));

import { OpeningLotCard } from '../../src/components/my-day/OpeningLotCard';

// The overnight carry-over card. Untested until 2026-08-25, when Aaron hit it from a MID shift:
// *"this shouldn't be buried in the shift hand-off."*
//
// It had been gated to `shiftType === 'opening'` in MyDayView, on the assumption that an opener
// would always be the one to inherit the lot and repair a missing close. One operator on a
// rotating shift is frequently NOT on an opening — so the card vanished and the backfill survived
// only inside the Log Shift Handoff modal, at the END of the day it was meant to inform.

const priorClose = (over: Record<string, unknown> = {}) => ({
  date: shiftDateStr(-1), carsRemaining: 4, cleanNotPickedUp: 3,
  fullPages: 2, lastPageEntries: 6, ...over,
});

beforeEach(() => { washbayLogs = []; submitWashbayLog.mockClear(); });

describe('OpeningLotCard', () => {
  describe('last night was NOT closed — the repair prompt', () => {
    it('shows on a mid, not just an opening — the number is missing either way', () => {
      render(<OpeningLotCard openedToday={false} />);
      expect(screen.getByText(/No closing log from last night/)).toBeInTheDocument();
    });

    it('writes the reconstructed close stamped to YESTERDAY, not today', async () => {
      render(<OpeningLotCard openedToday={false} />);
      fireEvent.click(screen.getByLabelText('More — Dirties left in queue'));
      fireEvent.click(screen.getByLabelText('More — Dirties left in queue'));
      fireEvent.click(screen.getByLabelText('More — Clean, not picked up'));
      fireEvent.click(screen.getByRole('button', { name: /Log last night/ }));

      await waitFor(() => expect(submitWashbayLog).toHaveBeenCalled());
      const [payload, date] = submitWashbayLog.mock.calls[0];
      expect(date).toBe(shiftDateStr(-1));
      expect(payload).toMatchObject({ carsRemaining: 2, cleanNotPickedUp: 1 });
      // Zeroed gas-sheet counters are what `isCarryOverOnly` keys on, keeping a
      // reconstructed close out of throughput averages it never earned.
      expect(payload).toMatchObject({ fullPages: 0, lastPageEntries: 0 });
    });

    it('never goes below zero', () => {
      render(<OpeningLotCard />);
      fireEvent.click(screen.getByLabelText('Fewer — Dirties left in queue'));
      expect(screen.getByLabelText('More — Dirties left in queue').previousSibling).toHaveTextContent('0');
    });
  });

  describe('last night WAS closed — the read-only inheritance', () => {
    it('reports what carried over', () => {
      washbayLogs = [priorClose()];
      render(<OpeningLotCard />);
      expect(screen.getByText(/3/)).toBeInTheDocument();
      expect(screen.getByText(/Dirties carried into your morning rate/)).toBeInTheDocument();
      expect(screen.queryByText(/No closing log/)).not.toBeInTheDocument();
    });

    it('celebrates a genuinely clean lot instead of printing two zeros', () => {
      washbayLogs = [priorClose({ carsRemaining: 0, cleanNotPickedUp: 0 })];
      render(<OpeningLotCard />);
      expect(screen.getByText(/Clean lot/)).toBeInTheDocument();
    });

    it('ignores a log from any day that is not yesterday', () => {
      washbayLogs = [priorClose({ date: shiftDateStr(-4) })];
      render(<OpeningLotCard />);
      expect(screen.getByText(/No closing log from last night/)).toBeInTheDocument();
    });
  });

  describe('wording follows who actually arrived', () => {
    it('says "You walked into" for the opener', () => {
      washbayLogs = [priorClose()];
      render(<OpeningLotCard openedToday />);
      expect(screen.getByText('You walked into')).toBeInTheDocument();
    });

    // A 10:30 mid did not walk into last night's lot — the opener did. Same data, honest claim.
    it('says "The day started with" for everyone else', () => {
      washbayLogs = [priorClose()];
      render(<OpeningLotCard openedToday={false} />);
      expect(screen.getByText('The day started with')).toBeInTheDocument();
      expect(screen.queryByText('You walked into')).not.toBeInTheDocument();
    });
  });
});
