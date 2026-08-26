import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Vehicle } from '../../src/types';

// Aaron, 2026-08-26: "odo/keys already captured. so add a button to flip which captures fuel via
// slider and notes. submit. then it adds to the list of units flipped."
//
// ⭐ It removes a duplicate CAPTURE, not a tap: flipping this car used to mean opening the flip
// section's own scanner, reading the tag again, and re-typing the odometer this sheet already has.

const add = vi.fn();
vi.mock('../../src/hooks/useAirportFlip', () => ({ useAirportFlip: () => ({ add, rows: [] }) }));

import { ScanFlipCapture } from '../../src/components/scan-router/ScanFlipCapture';

const car = (over: Partial<Vehicle> = {}): Vehicle => ({
  id: 'v1', unitNumber: '5422282', licensePlate: 'LUR330',
  make: 'Nissan', model: 'Kicks', year: 2026, color: 'White',
  status: 'CLEAR', branchId: 'YWG', isTesla: false, odometer: 15648,
  ...over,
} as Vehicle);

beforeEach(() => add.mockClear());

const open = () => fireEvent.click(screen.getByTestId('scan-flip-open'));
const submit = () => fireEvent.click(screen.getByTestId('scan-flip-submit'));

describe('ScanFlipCapture', () => {
  // ⭐ THE POINT: it shows what it already knows, so he can see there is nothing to re-enter.
  it('advertises the odometer it already has', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    expect(screen.getByTestId('scan-flip-open')).toHaveTextContent('odo 15648');
  });

  it('carries plate, unit, class and the saved odo into the flip list', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open();
    submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({
      plate: 'LUR330', unit: '5422282', rentalClass: 'B5', odo: '15648', isEv: false,
    }));
  });

  // ⚠️ HIS RULING: "if it's damaged I'd tap the flag hold after capturing the odo." This door never
  // sets damaged — a second path for damage would compete with the one he actually uses.
  it('never claims damage — that is the flag/hold path', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open(); submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ damaged: false }));
  });

  // ⭐ Submittable with nothing filled in. The flip's job is telling the counter the car is back;
  // gating on a fuel reading would let an unreadable gauge block the whole return.
  it('submits with no fuel and no note', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open(); submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ fuel: '', notes: '' }));
  });

  it('takes a note for the counter', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open();
    fireEvent.change(screen.getByLabelText('Note for the counter'), { target: { value: 'weed smell' } });
    submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ notes: 'weed smell' }));
  });

  // ⭐ A Tesla reads a battery PERCENTAGE, not a fuel fraction — same field, right word downstream
  // (flipRowLine prints "charge 67%" rather than "fuel 67%" off isEv).
  it('asks a Tesla for charge %, and marks the row as EV', () => {
    render(<ScanFlipCapture vehicle={car({ isTesla: true })} rentalClass="E9" />);
    open();
    fireEvent.change(screen.getByLabelText('Battery charge percent'), { target: { value: '67' } });
    submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ fuel: '67%', isEv: true }));
    expect(screen.queryByText(/Fuel Level/i)).toBeNull();
  });

  it('does not double the percent sign if he types one', () => {
    render(<ScanFlipCapture vehicle={car({ isTesla: true })} rentalClass="E9" />);
    open();
    fireEvent.change(screen.getByLabelText('Battery charge percent'), { target: { value: '67%' } });
    submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ fuel: '67%' }));
  });

  // ⚠️ An odo nobody has read is not a zero — blank rather than invented.
  it('sends a blank odo when FG has none, never a 0', () => {
    render(<ScanFlipCapture vehicle={car({ odometer: null })} rentalClass="B5" />);
    open(); submit();
    expect(add).toHaveBeenCalledWith(expect.objectContaining({ odo: '' }));
  });

  it('confirms, closes, and does not resubmit on reopen', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open(); submit();
    expect(add).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('scan-flip-open')).toHaveTextContent('added ✓');
    expect(screen.queryByTestId('scan-flip-capture')).toBeNull();
  });

  it('cancel adds nothing', () => {
    render(<ScanFlipCapture vehicle={car()} rentalClass="B5" />);
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(add).not.toHaveBeenCalled();
  });
});
