// + Add a car already cleaned (2026-11-05, docs/ticket-bay-add-a-car-cleaned.md): *"just a way to add them in if needed
// is enough"*. Pick a car, one tap adds it; the card closes only when it landed.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const car = { id: 'v-503', licensePlate: 'LZM503', unitNumber: '5421', year: 2026, make: 'Kia', model: 'Seltos', color: 'Blue' };
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ vehicles: [car], archivedVehicles: [] }),
}));
vi.mock('../../src/hooks/useLookupRecents', () => ({ useLookupRecents: () => ({ recents: [], record: vi.fn(async () => {}) }) }));
// The lookup itself is tested on its own; here it is one button that picks LZM503, and one that types a stranger.
vi.mock('../../src/components/shared/VehicleLookup', () => ({
  VehicleLookup: ({ onPick }: { onPick: (c: unknown) => void }) => (
    <>
      <button type="button" onClick={() => onPick({ vehicle: { license_plate: 'LZM503', unit_number: '5421' } })}>pick LZM503</button>
      <button type="button" onClick={() => onPick({ typed: 'ZZZ999' })}>type ZZZ999</button>
    </>
  ),
}));
const { BayAddCleaned } = await import('../../src/components/lot/BayAddCleaned');

describe('BayAddCleaned', () => {
  it('⭐ closed it is one quiet line; open, pick, and one tap adds the car', async () => {
    const onAdd = vi.fn(async () => true);
    render(<BayAddCleaned onAdd={onAdd} onMore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add a car already cleaned' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick LZM503' }));
    expect(screen.getByText(/added later · \+1 Erin St cleans/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Add as clean/ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('v-503', 'LZM503'));
    await waitFor(() => expect(screen.getByRole('button', { name: '+ Add a car already cleaned' })).toBeTruthy());
  });

  it('a save that did not land keeps the car on the card, to try again', async () => {
    const onAdd = vi.fn(async () => false);
    render(<BayAddCleaned onAdd={onAdd} onMore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add a car already cleaned' }));
    fireEvent.click(screen.getByRole('button', { name: 'pick LZM503' }));
    fireEvent.click(screen.getByRole('button', { name: /Add as clean/ }));
    await waitFor(() => expect(onAdd).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /Add as clean/ })).toBeTruthy();
  });

  it('a key FG cannot place offers the full search, never a dead end', () => {
    const onMore = vi.fn();
    render(<BayAddCleaned onAdd={vi.fn(async () => true)} onMore={onMore} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add a car already cleaned' }));
    fireEvent.click(screen.getByRole('button', { name: 'type ZZZ999' }));
    fireEvent.click(screen.getByRole('button', { name: /ZZZ999 isn.t a car in FG/ }));
    expect(onMore).toHaveBeenCalled();
  });

  it('Cancel closes it without adding', () => {
    const onAdd = vi.fn(async () => true);
    render(<BayAddCleaned onAdd={onAdd} onMore={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: '+ Add a car already cleaned' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '+ Add a car already cleaned' })).toBeTruthy();
  });
});
