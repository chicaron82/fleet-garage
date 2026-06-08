import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FleetBalanceEntry, FleetBalanceProjection } from '../../src/hooks/useFleetBalance';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', employeeId: 'E1', name: 'Aaron S.', role: 'VSA', branchId: 'YWG' } }),
}));

vi.mock('../../src/hooks/useUserResolver', () => ({
  useUserResolver: () => ({ getName: () => 'Aaron S.' }),
}));

import { FleetBalanceEntryForm } from '../../src/components/vehicle/FleetBalanceEntryForm';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ENTRY: FleetBalanceEntry = {
  id: 'fb-1', date: '2026-06-08', outCount: 122, inCount: 51,
  enteredById: 'u1', enteredAt: '2026-06-08T07:28:00.000Z',
};
const PROJECTION: FleetBalanceProjection = { avgOut: 89, avgIn: 57, label: 'Based on weekday avg' };

// The bug: todayEntry arrives async from the parent fetch. Seeding `editing`
// from it once at mount stranded the form blank in entry mode (showing the
// estimate) after a remount that painted before the fetch resolved.

describe('FleetBalanceEntryForm', () => {
  it('shows the entry form while today’s entry is still loading (undefined)', () => {
    render(<FleetBalanceEntryForm onSubmit={vi.fn()} todayEntry={undefined} projection={PROJECTION} />);
    expect(screen.getByRole('button', { name: /log numbers/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it('flips to the saved summary when todayEntry resolves after mount (regression: no frozen blank form)', () => {
    const { rerender } = render(
      <FleetBalanceEntryForm onSubmit={vi.fn()} todayEntry={undefined} projection={PROJECTION} />
    );
    // entry mode while the parent fetch is in flight
    expect(screen.getByRole('button', { name: /log numbers/i })).toBeInTheDocument();

    // fetch resolves → the prop arrives on the SAME instance (no remount)
    rerender(<FleetBalanceEntryForm onSubmit={vi.fn()} todayEntry={ENTRY} projection={PROJECTION} />);

    // must show the saved numbers, not the stale blank entry form + estimate
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /log numbers/i })).not.toBeInTheDocument();
    expect(screen.getByText('122')).toBeInTheDocument();
    expect(screen.getByText('51')).toBeInTheDocument();
  });

  it('renders the summary directly when the entry is present at mount', () => {
    render(<FleetBalanceEntryForm onSubmit={vi.fn()} todayEntry={ENTRY} projection={null} />);
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeInTheDocument();
    expect(screen.getByText('122')).toBeInTheDocument();
  });

  it('seeds the inputs from todayEntry when Edit is clicked', async () => {
    const user = userEvent.setup();
    render(<FleetBalanceEntryForm onSubmit={vi.fn()} todayEntry={ENTRY} projection={null} />);
    await user.click(screen.getByRole('button', { name: /^edit$/i }));
    // now in form mode with the existing numbers pre-filled, not blank
    expect(screen.getByDisplayValue('122')).toBeInTheDocument();
    expect(screen.getByDisplayValue('51')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log numbers/i })).toBeInTheDocument();
  });
});
