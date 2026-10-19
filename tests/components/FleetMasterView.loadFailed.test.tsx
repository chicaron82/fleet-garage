// A dead network used to show an EMPTY fleet: loadFleet threw its errors away and the screen drew "no cars".
// (2026-10-18, docs/ticket-waited-on-reads-still-wait-seven-seconds.md.)
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', branchId: 'YWG', role: 'VSA', name: 'Aaron S.' } }),
}));
const loadFleet = vi.fn();
vi.mock('../../src/lib/fleet-master', async (orig) => ({ ...(await orig<Record<string, unknown>>()), loadFleet: (b: string) => loadFleet(b) }));
vi.mock('../../src/hooks/useFleetAudit', () => ({ useFleetAudit: () => ({ findings: [], loaded: true, dismiss: vi.fn() }) }));
vi.mock('../../src/hooks/useFleetTrend', () => ({ useFleetTrend: () => ({ baseline: null, rows: [] }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ archiveVehicle: vi.fn() }) }));
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

describe('FleetMasterView — a fleet that could not load', () => {
  it('⭐ says so with a way to try again, never an empty fleet', async () => {
    loadFleet.mockRejectedValueOnce(new Error('The fleet could not load.'));
    render(<FleetMasterView onNavigate={vi.fn()} onRegisterNew={vi.fn()} refreshKey={0} />);
    expect(await screen.findByRole('alert')).toHaveTextContent("The fleet couldn't load");
    expect(screen.queryByPlaceholderText(/Search plate, unit, or class/i)).toBeNull();
    loadFleet.mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(loadFleet).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
