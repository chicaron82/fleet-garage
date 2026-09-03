// ⭐ The banner lists HOLDS but renders one chip per VEHICLE. A car can carry several stale holds
// at once, and the first version mapped straight across — rendering the same unit number twice as
// two identical buttons, and tripping React's duplicate-key warning because the key was the vehicle
// id all along. Found 2026-09-03 in a console readout while render-verifying an unrelated change.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StaleHoldsAlert } from '../../src/components/dashboard/StaleHoldsAlert';
import type { Hold, Vehicle } from '../../src/types';

const VEHICLE_ID = 'c6c1a171-7756-4d5a-89b4-e806e6fca0c7';

const vehicle = { id: VEHICLE_ID, unitNumber: '5426952' } as Vehicle;
const other = { id: 'v2', unitNumber: '5423140' } as Vehicle;

const hold = (id: string, vehicleId: string, holdType: string) =>
  ({ id, vehicleId, holdType, status: 'ACTIVE' }) as unknown as Hold;

function renderAlert(staleHolds: Hold[], vehicles: Vehicle[] = [vehicle, other]) {
  const onSelectVehicle = vi.fn();
  render(
    <StaleHoldsAlert role="GM" staleHolds={staleHolds} vehicles={vehicles}
      onSelectVehicle={onSelectVehicle} />,
  );
  return { onSelectVehicle };
}

describe('StaleHoldsAlert', () => {
  it('⭐ renders ONE chip for a vehicle carrying two stale holds', () => {
    // The real case: LUR306 sat on a damage hold and a hail hold simultaneously.
    renderAlert([hold('h1', VEHICLE_ID, 'damage'), hold('h2', VEHICLE_ID, 'hail')]);
    expect(screen.getAllByRole('button', { name: '5426952' })).toHaveLength(1);
  });

  it('still counts HOLDS in the heading, not vehicles — the count is the true number', () => {
    renderAlert([hold('h1', VEHICLE_ID, 'damage'), hold('h2', VEHICLE_ID, 'hail')]);
    expect(screen.getByText(/2 holds have been active/)).toBeInTheDocument();
  });

  it('two different vehicles still get two chips', () => {
    renderAlert([hold('h1', VEHICLE_ID, 'damage'), hold('h2', 'v2', 'mechanical')]);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('a chip still navigates to its vehicle', async () => {
    const { onSelectVehicle } = renderAlert([hold('h1', VEHICLE_ID, 'damage')]);
    screen.getByRole('button', { name: '5426952' }).click();
    expect(onSelectVehicle).toHaveBeenCalledWith(VEHICLE_ID);
  });

  it('a vehicle FG cannot find still gets a chip rather than vanishing', () => {
    renderAlert([hold('h1', 'ghost', 'damage')], []);
    expect(screen.getByRole('button', { name: 'Unknown' })).toBeInTheDocument();
  });
});
