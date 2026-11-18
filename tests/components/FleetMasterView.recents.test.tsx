import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// docs/ticket-recent-cars-everywhere-and-restore-from-find.md. Aaron, 2026-11-18, on the lot:
// *"I was in the fleet module looking up a vehicle but it doesn't show my last search. So I have to retype it"*, and his
// 14:33 screenshot: "No active vehicle found for LUR528" about 7 minutes after he had restored LUR528.

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', branchId: 'YWG', role: 'VSA', name: 'Aaron S.' } }),
}));

const HELD = {
  id: 'v2', unitNumber: '5422283', licensePlate: 'LZM441', make: 'Kia', model: 'Seltos',
  year: 2026, color: 'Black', status: 'held', branchId: 'YWG', rentalClass: 'B5', holdCount: 1, holdSummary: ['Dent'],
};
const RESTORED = {
  id: 'v1', unitNumber: '5429451', licensePlate: 'LUR528', make: 'Toyota', model: 'Corolla',
  year: 2026, color: 'White', status: 'clear', branchId: 'YWG', rentalClass: 'C',
};
let fleet: object[] = [HELD];
vi.mock('../../src/lib/fleet-master', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  loadFleet: async () => fleet,
}));

let archived: { id: string }[] = [];
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ archiveVehicle: vi.fn(), archivedVehicles: archived }) }));

const record = vi.fn(async () => {});
const recents = [{ license_plate: 'LUR528', unit_number: '5429451', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', is_hybrid: false, is_tesla: false }];
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents, record }) }));

vi.mock('../../src/hooks/useFleetAudit', () => ({ useFleetAudit: () => ({ findings: [], loaded: true, dismiss: vi.fn() }) }));
vi.mock('../../src/hooks/useFleetTrend', () => ({ useFleetTrend: () => ({ baseline: null, rows: [] }) }));
vi.mock('../../src/hooks/useFleetHistory', () => ({
  useFleetHistory: () => ({
    holdDates: [], flaggedVehicleIds: new Set(), sightingsByVehicle: new Map(), sightingsWeekAgo: new Map(),
    lastSeenByVehicle: new Map(), lastTripByPlate: new Map(), lastSheetByPlate: new Map(),
    window: null, loading: true, error: false,
  }),
}));
vi.mock('../../src/components/analytics/FleetHistorySection', () => ({ FleetHistorySection: () => null }));
vi.mock('../../src/components/vehicle/FleetArchivedSection', () => ({ FleetArchivedSection: () => null }));

import { FleetMasterView } from '../../src/components/vehicle/FleetMasterView';

const searchBox = () => screen.getByPlaceholderText(/Search plate, unit, or class/i) as HTMLInputElement;
const view = (onNavigate = vi.fn()) => <FleetMasterView onNavigate={onNavigate} onRegisterNew={vi.fn()} refreshKey={0} />;

beforeEach(() => { fleet = [HELD]; archived = []; record.mockClear(); });

describe('Fleet search: his recent cars', () => {
  it('⭐ tapping the empty box shows them; a tap fills the search he would have retyped', async () => {
    render(view());
    await screen.findByPlaceholderText(/Search plate, unit, or class/i);
    expect(screen.queryByTestId('recent-cars')).toBeNull();
    fireEvent.focus(searchBox());
    fireEvent.click(await screen.findByRole('button', { name: /LUR528/ }));
    expect(searchBox().value).toBe('LUR528');
  });

  it('they step aside the moment he types', async () => {
    render(view());
    await screen.findByPlaceholderText(/Search plate, unit, or class/i);
    fireEvent.focus(searchBox());
    expect(screen.getByTestId('recent-cars')).toBeInTheDocument();
    fireEvent.change(searchBox(), { target: { value: 'LZ' } });
    expect(screen.queryByTestId('recent-cars')).toBeNull();
  });

  it('a whole plate typed is remembered; opening a car from the list is too', async () => {
    render(view());
    await screen.findByPlaceholderText(/Search plate, unit, or class/i);
    fireEvent.change(searchBox(), { target: { value: 'LZM441' } });
    await waitFor(() => expect(record).toHaveBeenCalledWith('v2'));
    record.mockClear();
    fireEvent.click(screen.getByRole('button', { name: /LZM441/ }));
    expect(record).toHaveBeenCalledWith('v2');
  });
});

describe('Fleet after a restore', () => {
  it('⭐⭐ a car restored elsewhere is found, not reported missing (his LUR528 screenshot)', async () => {
    archived = [{ id: 'v1' }];
    const { rerender } = render(view());
    await screen.findByPlaceholderText(/Search plate, unit, or class/i);
    fireEvent.change(searchBox(), { target: { value: 'LUR528' } });
    expect(screen.getByText(/No active vehicle found for/)).toBeInTheDocument();   // archived: true at the time

    // He restores it (Find a car / the Archived section / Register): the context's archived set changes.
    fleet = [HELD, RESTORED];
    archived = [];
    rerender(view());
    await waitFor(() => expect(screen.queryByText(/No active vehicle found for/)).toBeNull());
    expect(screen.getByRole('button', { name: /LUR528/ })).toBeInTheDocument();
  });
});
