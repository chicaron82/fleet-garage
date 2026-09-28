import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';

const ctx = vi.hoisted(() => ({
  vehicles: [] as unknown[], holds: [] as unknown[],
  syncVehicleStatus: vi.fn(async (_id: string) => true),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({ useVehicleHoldContext: () => ctx }));

import { HiddenHoldsAlert } from '../../src/components/dashboard/HiddenHoldsAlert';

// ⭐ Aaron, 2026-09-28: LUR479 came up "PM due" while he logged odometers, yet the Holds list never
// showed it — *"i thought i cleared all the PM vehicles held."* This is the warning that names it.
describe('HiddenHoldsAlert', () => {
  beforeEach(() => {
    ctx.vehicles = [{ id: 'v1', licensePlate: 'LUR479', status: 'CLEAR' }];
    ctx.holds = [{ id: 'h1', vehicleId: 'v1', status: 'ACTIVE' }];
    ctx.syncVehicleStatus.mockReset(); ctx.syncVehicleStatus.mockResolvedValue(true);
  });

  it('⭐ names the hidden car', () => {
    render(<HiddenHoldsAlert onSelectVehicle={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/1 car has an active hold but reads Clear/);
    expect(screen.getByRole('button', { name: 'LUR479' })).toBeInTheDocument();
  });

  it('says nothing when every held car is listed', () => {
    ctx.vehicles = [{ id: 'v1', licensePlate: 'LUR479', status: 'HELD' }];
    const { container } = render(<HiddenHoldsAlert onSelectVehicle={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Fix re-derives that car', async () => {
    const user = userEvent.setup();
    render(<HiddenHoldsAlert onSelectVehicle={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Fix' }));
    expect(ctx.syncVehicleStatus).toHaveBeenCalledWith('v1');
  });

  it('⚠️ a fix that did not save SAYS so', async () => {
    ctx.syncVehicleStatus.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<HiddenHoldsAlert onSelectVehicle={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Fix' }));
    expect(await screen.findByText(/didn't save/i)).toBeInTheDocument();
  });

  it('tapping the plate opens the car', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<HiddenHoldsAlert onSelectVehicle={onSelect} />);
    await user.click(screen.getByRole('button', { name: 'LUR479' }));
    expect(onSelect).toHaveBeenCalledWith('v1');
  });
});
