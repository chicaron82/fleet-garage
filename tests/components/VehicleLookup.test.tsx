// The one typed-lookup affordance.
//
// ⭐⭐ WHY IT EXISTS: Aaron, 2026-09-04 — *"i feel the look up should work like movement log… plate
// may be unreadable but you can still look up the unit right?… this isn't a new thing. its just
// applied differently."* Four surfaces answered *which car is this* four ways, and the only one that
// ever tried the UNIT NUMBER was the scan resolver — the one place least likely to need it.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const searchVehicles = vi.fn();
vi.mock('../../src/lib/ev-detection', () => ({ searchVehicles }));

const { VehicleLookup } = await import('../../src/components/shared/VehicleLookup');

const CAR = {
  license_plate: 'LUR512', unit_number: '5426952', make: 'Volvo', model: 'XC60',
  year: 2026, color: 'Grey', is_hybrid: false, is_tesla: false,
};

beforeEach(() => { vi.clearAllMocks(); searchVehicles.mockResolvedValue([CAR]); });

const type = (value: string) =>
  fireEvent.change(screen.getByLabelText(/Look up a vehicle/), { target: { value } });

describe('VehicleLookup', () => {
  it('suggests cars as he types, like the Movement Log', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR');
    await waitFor(() => expect(screen.getByText('LUR512')).toBeInTheDocument());
    expect(screen.getByText(/2026 Volvo XC60/)).toBeInTheDocument();
  });

  // ⭐ FG never resolves on a weaker key without saying which key did the work — the rule the scan
  // card already follows with `matchedByUnit`. A car found by its unit says so.
  it('⭐ names the unit when the UNIT is what matched, not the plate', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('5426');
    await waitFor(() => expect(screen.getByText(/unit 5426952/)).toBeInTheDocument());
  });

  it('does not say "unit" when the plate is what matched', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('LUR5');
    await waitFor(() => expect(screen.getByText('LUR512')).toBeInTheDocument());
    expect(screen.queryByText(/unit 5426952/)).toBeNull();
  });

  it('hands the chosen car back to the caller', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    type('LUR');
    await waitFor(() => screen.getByText('LUR512'));
    fireEvent.click(screen.getByText('LUR512'));
    expect(onPick).toHaveBeenCalledWith({ vehicle: CAR });
  });

  // ⚠️ TYPED, THEREFORE NEVER CORRECTED — the misread corrector belongs under a camera, not under
  // his thumbs. Committing text that matched nothing is still a legitimate answer.
  it('hands back the raw text when he commits something with no match', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    type('lur 999');
    fireEvent.click(screen.getByRole('button', { name: 'Look up' }));
    expect(onPick).toHaveBeenCalledWith({ typed: 'LUR999' });
  });

  // ⚠️ Two characters is the floor the shared query enforces; asking the database on every keystroke
  // of a one-letter prefix is a request for the whole fleet.
  it('does not search on a single character', async () => {
    render(<VehicleLookup onPick={vi.fn()} />);
    type('L');
    await new Promise(r => setTimeout(r, 260));
    expect(searchVehicles).not.toHaveBeenCalled();
  });
});
