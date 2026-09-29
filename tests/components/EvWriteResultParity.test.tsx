import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VehicleEVAssets } from '../../src/components/vehicle/VehicleEVAssets';
import { DriverLiveTransitView } from '../../src/components/movement/DriverLiveTransitView';
import type { Vehicle } from '../../src/types';

// ⚠️ `updateVehicleEVAssets` swallows its Supabase error and RETURNS FALSE — that return is the only
// way a caller can tell a saved assessment from a lost one. Six callers; three were dropping it
// (line-check 2026-09-28). These pin the two UI shapes that carry no save button.

const TESLA: Vehicle = {
  id: 'v1', unitNumber: '5429999', licensePlate: 'LUR999',
  make: 'Tesla', model: 'Model 3', year: 2025, color: 'White',
  status: 'CLEAR', branchId: 'YWG', isTesla: true, hasMobileCable: true, hasJ1772Adapter: true,
} as Vehicle;

vi.mock('../../src/components/vehicle/EVAssetHistoryPanel', () => ({ EVAssetHistoryPanel: () => null }));
vi.mock('../../src/components/vehicle/EvLoanSection', () => ({ EvLoanSection: () => null }));

describe('VehicleEVAssets — the checkbox IS the write, so it must speak for itself', () => {
  beforeEach(() => vi.clearAllMocks());

  it('⭐ says so when the write returns false — it used to just snap the box back', async () => {
    const update = vi.fn().mockResolvedValue(false);
    render(<VehicleEVAssets vehicle={TESLA} userRole="VSA" updateVehicleEVAssets={update} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(await screen.findByText(/didn't save/i)).toBeInTheDocument();
  });

  it('stays quiet when the write lands', async () => {
    const update = vi.fn().mockResolvedValue(true);
    render(<VehicleEVAssets vehicle={TESLA} userRole="VSA" updateVehicleEVAssets={update} />);
    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });
});

describe('DriverLiveTransitView — a lost EV log reports without claiming the trip failed', () => {
  const props = {
    vehicleDetails: null, plate: 'LUR999', fromLabel: 'Erin St', toLabel: 'Airport',
    departureTime: new Date().toISOString(), elapsed: '0:05', notes: '', setNotes: vi.fn(),
    submitting: false, handleArrived: vi.fn(), handleCancelTrip: vi.fn(),
  } as unknown as Parameters<typeof DriverLiveTransitView>[0];

  it('⭐ shows the trip-started-but-log-lost line', () => {
    render(<DriverLiveTransitView {...props} saveError={false} evLogFailed />);
    expect(screen.getByText(/Trip started — the EV asset check didn't save/i)).toBeInTheDocument();
  });

  it('⚠️ yields to the trip-level error — two alarms for one failure is noise', () => {
    render(<DriverLiveTransitView {...props} saveError evLogFailed />);
    expect(screen.getByText(/Couldn't save — check connection/i)).toBeInTheDocument();
    expect(screen.queryByText(/Trip started —/i)).toBeNull();
  });

  it('says nothing when the log landed', () => {
    render(<DriverLiveTransitView {...props} saveError={false} evLogFailed={false} />);
    expect(screen.queryByText(/didn't save/i)).toBeNull();
  });
});
