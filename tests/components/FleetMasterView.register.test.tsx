import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Aaron, 2026-08-26, on a faded key tag he could not scan: "entered the plate, no match. register.
// get to the form but the plate didn't transfer. so had to enter it again."
//
// Diagnostic first: the no-match CTA passes the search term on paper, so this pins whether the
// path he described actually carries it — and whether the OTHER register button on the same
// screen, the one sitting right beside the search box, throws it away.

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', branchId: 'YWG', role: 'VSA', name: 'Aaron S.' } }),
}));
// One real-looking car, so the "no vehicles at all" empty state does not also render and the
// no-match CTA is the only register affordance below the fold.
vi.mock('../../src/lib/fleet-master', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  loadFleet: async () => ([{
    id: 'v1', unitNumber: '5422282', licensePlate: 'LUR330', make: 'Nissan', model: 'Kicks',
    year: 2026, color: 'White', status: 'CLEAR', branchId: 'YWG', rentalClass: 'B5',
  }]),
}));
vi.mock('../../src/hooks/useFleetAudit', () => ({
  useFleetAudit: () => ({ findings: [], loaded: true, dismiss: vi.fn() }),
}));
vi.mock('../../src/hooks/useFleetTrend', () => ({ useFleetTrend: () => ({ baseline: null, rows: [] }) }));
// ⚠️ The History cards moved into Fleet on 2026-09-06 and they reach for supabase and the vehicle
// context. This test is about the REGISTER path carrying his typed plate; without the stub the whole
// tree throws and the body renders empty, which fails as "search box not found" and says nothing
// about the thing under test. Stubbed rather than provided: FleetHistorySection has its own cover.
vi.mock('../../src/components/analytics/FleetHistorySection', () => ({
  FleetHistorySection: () => null,
}));

import { FleetMasterView } from '../../src/components/vehicle/FleetMasterView';

const onRegisterNew = vi.fn();
beforeEach(() => onRegisterNew.mockClear());

const searchBox = () => screen.getByPlaceholderText(/Search plate, unit, or class/i);

async function mount() {
  render(<FleetMasterView onNavigate={vi.fn()} onRegisterNew={onRegisterNew} refreshKey={0} />);
  // The fleet loads asynchronously; the search box does not exist until it has.
  await screen.findByPlaceholderText(/Search plate, unit, or class/i);
}

async function searchFor(term: string) {
  await mount();
  fireEvent.change(searchBox(), { target: { value: term } });
  await waitFor(() => expect(screen.getByText(/No vehicle found/i)).toBeInTheDocument());
}

describe('registering from Fleet carries what he typed', () => {
  it('the no-match CTA hands the plate to the form', async () => {
    await searchFor('WP081F');
    fireEvent.click(screen.getByRole('button', { name: /Register this vehicle/i }));
    expect(onRegisterNew).toHaveBeenCalledWith('WP081F');
  });

  // ⭐⭐ THE ONE THAT MATTERS. Two buttons on screen do nearly the same thing, and the one that
  // DISCARDS the search is the one sitting right beside the box he just typed into — at thumb
  // level, labelled "Add Vehicle", while the CTA that keeps it is further down the page. There is
  // no case where throwing away what he just typed is the desirable behaviour.
  it('⭐ "Add Vehicle" carries the search term too, rather than discarding it', async () => {
    await searchFor('WP081F');
    fireEvent.click(screen.getByRole('button', { name: /Register a vehicle/i }));
    expect(onRegisterNew).toHaveBeenCalledWith('WP081F');
  });

  it('…and passes nothing when he has not searched for anything', async () => {
    await mount();
    fireEvent.click(screen.getByRole('button', { name: /Register a vehicle/i }));
    expect(onRegisterNew).toHaveBeenCalledTimes(1);
    expect(onRegisterNew.mock.calls[0][0]).toBeUndefined();
  });
});
