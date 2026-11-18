// His recent cars in the movement log's plate box (docs/ticket-recent-cars-everywhere-and-restore-from-find.md). Asked
// "Movement log in or out?", Aaron, 2026-11-18: *"In"*. The car he sends up is usually one he just touched.
// ⚠️ TripForm, not DriverLiveForm: the first cut went into the DRIVER's form, which he never sees. The render at his
// width (as the VSA account) showed "E.G. LUR156", and that placeholder lives here.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'VSA', branchId: 'YWG' } }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ vehicles: [{ id: 'v1', licensePlate: 'LUR528', unitNumber: '5429451' }] }),
}));
const record = vi.fn(async () => {});
const RECENT = { license_plate: 'LUR528', unit_number: '5429451', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', is_hybrid: false, is_tesla: false };
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents: [RECENT], record }) }));
vi.mock('../../src/lib/ev-detection', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  searchVehicles: async () => ({ matches: [], failed: false }),
  detectTeslaByPlate: async () => ({ isTesla: false, lastCable: null, lastAdapter: null }),
}));
vi.mock('../../src/components/holds/KeytagSearchScan', () => ({ KeytagSearchScan: () => null }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

import { TripForm } from '../../src/components/movement/TripForm';

let plate = '';
const setVehiclePlate = vi.fn((v: string) => { plate = v; });
const form = () => (
  <TripForm
    isShuttle={false} shuttlePlate="" setShuttlePlate={vi.fn()}
    vehiclePlate={plate} setVehiclePlate={setVehiclePlate}
    flaggedClasses={[]} onShuttleToggle={vi.fn()} onQuickStart={vi.fn()}
    isTeslaRun={false} setIsTeslaRun={vi.fn()}
    evCableStatus={null} evAdapterStatus={null} setEvCableStatus={vi.fn()} setEvAdapterStatus={vi.fn()}
  />
);
const plateBox = () => screen.getByPlaceholderText('e.g. LUR156');

beforeEach(() => { plate = ''; setVehiclePlate.mockClear(); record.mockClear(); });

describe('movement log plate box: his recent cars', () => {
  it('⭐ the empty box offers them; a tap fills the plate exactly as a typed suggestion does', () => {
    render(form());
    expect(screen.queryByTestId('recent-cars')).toBeNull();
    fireEvent.focus(plateBox());
    fireEvent.click(screen.getByRole('button', { name: /LUR528/ }));
    expect(setVehiclePlate).toHaveBeenCalledWith('LUR528');
  });

  it('a plate already in the box hides them', () => {
    plate = 'LZ';
    render(form());
    fireEvent.focus(plateBox());
    expect(screen.queryByTestId('recent-cars')).toBeNull();
  });

  it('a whole plate in the box is remembered', async () => {
    plate = 'LUR528';
    render(form());
    await waitFor(() => expect(record).toHaveBeenCalledWith('v1'));
  });
});
