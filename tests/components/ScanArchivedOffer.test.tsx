// Restore from Find a car (docs/ticket-recent-cars-everywhere-and-restore-from-find.md). Aaron, 2026-11-18: *"I think the
// find a car should be able to view and have the option to restore an archived vehicle"*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

let role = 'VSA';
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role, branchId: 'YWG' } }) }));
const restoreVehicle = vi.fn(async (_id: string) => true);
const archivedVehicles = [{ id: 'v357', licensePlate: 'LUR357', unitNumber: '5422464', archivedAt: '2026-11-01T01:45:08Z' }];
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ({ archivedVehicles, restoreVehicle }) }));
vi.mock('../../src/lib/haptics', () => ({ hapticMedium: vi.fn() }));

import { ScanArchivedOffer } from '../../src/components/scan-router/ScanArchivedOffer';

beforeEach(() => { role = 'VSA'; restoreVehicle.mockReset(); restoreVehicle.mockResolvedValue(true); });

describe('ScanArchivedOffer', () => {
  it('⭐ an archived plate gets a Restore; a tap restores THAT car and opens it', async () => {
    const onRestored = vi.fn();
    render(<ScanArchivedOffer plate="LUR357" onRestored={onRestored} />);
    expect(screen.getByText(/FG has this car, archived since/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Restore to fleet/ }));
    await waitFor(() => expect(onRestored).toHaveBeenCalledWith('v357'));
    expect(restoreVehicle).toHaveBeenCalledWith('v357');
  });

  it('the unit finds it when the plate is missing', () => {
    render(<ScanArchivedOffer plate="" unit="5422464" onRestored={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Restore to fleet/ })).toBeInTheDocument();
  });

  it('a car FG never had gets nothing: "Not in the fleet" stays the answer', () => {
    const { container } = render(<ScanArchivedOffer plate="ZZZ999" onRestored={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('⚠️ a failed restore SAYS so and stays put, it never opens a car that is still archived', async () => {
    restoreVehicle.mockResolvedValue(false);
    const onRestored = vi.fn();
    render(<ScanArchivedOffer plate="LUR357" onRestored={onRestored} />);
    fireEvent.click(screen.getByRole('button', { name: /Restore to fleet/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Couldn’t restore it/);
    expect(onRestored).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Restore to fleet/ })).toBeEnabled();
  });

  it('a role that cannot manage vehicles is not offered it', () => {
    role = 'Driver';
    const { container } = render(<ScanArchivedOffer plate="LUR357" onRestored={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
