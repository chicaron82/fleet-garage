// ✓ Already cleaned in the empty bay's pick card (docs/ticket-bay-already-cleaned-in-the-empty-bay.md). Aaron,
// 2026-11-19: *"i'd have marked it off as cleaned before going off for break. so that box would be empty for the next
// 30min"*. So the cars his partner finished while he was off the floor are added from the card that's already empty.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BayLogState } from '../../src/hooks/useBayLog';

const car = { id: 'v-503', licensePlate: 'LZM503', unitNumber: '5421', year: 2026, make: 'Kia', model: 'Seltos', color: 'Blue', isUs: false };
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ vehicles: [car], archivedVehicles: [] }),
}));
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents: [], record: vi.fn(async () => {}) }) }));
// The lookup, the odo, the header and Start / On deck are tested on their own; here each is a stand-in.
vi.mock('../../src/components/shared/VehicleLookup', () => ({
  VehicleLookup: ({ onPick }: { onPick: (c: unknown) => void }) => (
    <button type="button" onClick={() => onPick({ vehicle: { license_plate: 'LZM503', unit_number: '5421' } })}>pick LZM503</button>
  ),
}));
vi.mock('../../src/components/shared/OdometerCapture', () => ({ OdometerCapture: () => null }));
vi.mock('../../src/components/scan-router/ScanBayStart', () => ({ ScanBayStart: () => <p>Start / On deck</p> }));
vi.mock('./../../src/components/lot/BayCarHeader', () => ({ BayCarHeader: ({ vehicle }: { vehicle: { licensePlate: string } }) => <p>{vehicle.licensePlate}</p> }));
const { BayFindCar } = await import('../../src/components/lot/BayFindCar');

const bay = {} as BayLogState;
const pick = () => fireEvent.click(screen.getByRole('button', { name: 'pick LZM503' }));
const already = () => screen.queryByRole('button', { name: /Already cleaned/ });

describe('BayFindCar: ✓ Already cleaned', () => {
  it('⭐ a third ending under Start / On deck; one tap adds the car and the card is empty again for the next one', async () => {
    const onAddCleaned = vi.fn(async () => true);
    render(<BayFindCar bay={bay} onMore={() => {}} onOpenCar={() => {}} onAddCleaned={onAddCleaned} />);
    pick();
    expect(screen.getByText('Start / On deck')).toBeTruthy();
    expect(screen.getByText(/added later · \+1 airport cleans/)).toBeTruthy();
    fireEvent.click(already()!);
    await waitFor(() => expect(onAddCleaned).toHaveBeenCalledWith('v-503', 'LZM503'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'pick LZM503' })).toBeTruthy());
    expect(already()).toBeNull();
  });

  it('a save that did not land keeps the car on the card, to try again', async () => {
    const onAddCleaned = vi.fn(async () => false);
    render(<BayFindCar bay={bay} onMore={() => {}} onOpenCar={() => {}} onAddCleaned={onAddCleaned} />);
    pick();
    fireEvent.click(already()!);
    await waitFor(() => expect(onAddCleaned).toHaveBeenCalled());
    await waitFor(() => expect((already() as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByRole('button', { name: 'pick LZM503' })).toBeNull();
  });

  it('without a host that can add (the scan popup path), the card offers only Start / On deck', () => {
    render(<BayFindCar bay={bay} onMore={() => {}} onOpenCar={() => {}} />);
    pick();
    expect(screen.getByText('Start / On deck')).toBeTruthy();
    expect(already()).toBeNull();
  });
});
