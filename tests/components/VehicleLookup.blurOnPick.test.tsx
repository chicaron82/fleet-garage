// The keyboard drops after a pick in the scan sheet (docs/ticket-scan-geotab-above-the-fold.md). Aaron, 2026-11-20,
// on LZM531: *"the amber alert was covered by the keyboard."* The field cleared on the pick but kept its focus.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const searchVehicles = vi.fn();
vi.mock('../../src/lib/ev-detection', () => ({ searchVehicles }));
const { VehicleLookup } = await import('../../src/components/shared/VehicleLookup');

const CAR = {
  license_plate: 'LZM531', unit_number: '5423124', make: 'Hyundai', model: 'Venue',
  year: 2026, color: 'White', is_hybrid: false, is_tesla: false,
};
beforeEach(() => { vi.clearAllMocks(); searchVehicles.mockResolvedValue({ matches: [CAR], failed: false }); });

const field = () => screen.getByLabelText(/Look up a vehicle/) as HTMLInputElement;
const focused = () => document.activeElement === field();

describe('VehicleLookup: blurOnPick', () => {
  it('⭐ picking a suggestion drops the keyboard, so the card it opens is seen whole', async () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} blurOnPick />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'LZM' } });
    await waitFor(() => expect(screen.getByText('LZM531')).toBeTruthy());
    expect(focused()).toBe(true);
    fireEvent.click(screen.getByText('LZM531'));
    expect(onPick).toHaveBeenCalledWith({ vehicle: CAR });
    expect(focused()).toBe(false);
  });

  it('Enter on typed text drops it too', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} blurOnPick />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'LZM531' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalledWith({ typed: 'LZM531' });
    expect(focused()).toBe(false);
  });

  it('a recent drops it too', () => {
    render(<VehicleLookup onPick={vi.fn()} blurOnPick recents={[CAR]} />);
    fireEvent.focus(field()); field().focus();
    fireEvent.click(screen.getByText('LZM531'));
    expect(focused()).toBe(false);
  });

  it('without it (every other host), the field keeps its focus after a pick, as before', () => {
    const onPick = vi.fn();
    render(<VehicleLookup onPick={onPick} />);
    field().focus();
    fireEvent.change(field(), { target: { value: 'LZM531' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onPick).toHaveBeenCalled();
    expect(focused()).toBe(true);
  });
});
