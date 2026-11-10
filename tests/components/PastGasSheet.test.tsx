// ⛽ A past gas sheet, entered on its own day, with the photo pinned (src/components/my-shift/PastGasSheet.tsx,
// migration 168). Aaron, 2026-11-09: *"I select a date and whatever I enter would write to that date"*, and of the
// pinned photo: *"that sounds bougie AF!!"*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { sheetDayBounds, winnipegDay } from '../../src/lib/sheetDay';

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(async (_fn: string, _args: Record<string, unknown>) => ({ data: { status: 'saved', reading_id: 11, sighting_id: 22, current: false, kept: { km: 48350, at: '2026-11-09T19:00:00Z' } } as unknown, error: null as unknown })),
}));
vi.mock('../../src/lib/supabase', () => ({ supabase: { rpc: (fn: string, a: Record<string, unknown>) => rpc(fn, a) } }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Aaron Sauddin', branchId: 'YWG' } }) }));
const car = (id: string, plate: string, unit: string, archivedAt: string | null = null) =>
  ({ id, licensePlate: plate, unitNumber: unit, make: 'Nissan', model: 'Versa', year: 2025, archivedAt });
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ vehicles: [car('v1', 'LUR247', '5427752'), car('v2', 'LUR273', '5427760')], archivedVehicles: [] }),
}));

import { PastGasSheet } from '../../src/components/my-shift/PastGasSheet';

beforeEach(() => { rpc.mockClear(); });

function open() {
  render(<PastGasSheet />);
  fireEvent.click(screen.getByTestId('past-gas-sheet-card'));
}
const typeRow = (plate: string, odo: string) => {
  fireEvent.change(screen.getByLabelText('Plate or unit'), { target: { value: plate } });
  fireEvent.change(screen.getByLabelText('Odo'), { target: { value: odo } });
};

describe('⭐ Past gas sheet', () => {
  it('opens on yesterday, and today is the latest day it takes', () => {
    open();
    const date = screen.getByLabelText(/Sheet date/i, { selector: 'input' }) as HTMLInputElement;
    const today = winnipegDay(Date.now());
    expect(date.max).toBe(today);
    expect(date.value < today).toBe(true);
  });

  it('⭐ a row writes to the SHEET\'s day: its bounds, its noon, him as the one who saw it', async () => {
    open();
    const date = screen.getByLabelText(/Sheet date/i, { selector: 'input' });
    fireEvent.change(date, { target: { value: '2026-11-07' } });
    typeRow('lur 247', '48,100');
    expect(screen.getByText(/2025 Nissan Versa · LUR247/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Save to/ }));
    const b = sheetDayBounds('2026-11-07');
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('record_sheet_odometer', {
      p_vehicle: 'v1', p_km: 48100, p_read_at: b.readAt, p_day_start: b.start, p_day_end: b.end,
      p_by_id: 'u1', p_by_name: 'Aaron Sauddin', p_branch: 'YWG', p_force: false,
    }));
    expect(await screen.findByText(/Kept the newer 48,350/)).toBeInTheDocument();
    expect((screen.getByLabelText('Plate or unit') as HTMLInputElement).value).toBe('');
  });

  it('⭐ Undo takes the row back with its visit', async () => {
    open();
    typeRow('LUR247', '48100');
    fireEvent.click(screen.getByRole('button', { name: /^Save to/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith('undo_sheet_odometer', { p_reading: 11, p_sighting: 22 }));
    expect(await screen.findByText('Taken back')).toBeInTheDocument();
  });

  it('⭐ a row that doesn\'t fit is written nowhere, says why, and Save anyway sends it forced', async () => {
    rpc.mockResolvedValueOnce({ data: { status: 'conflict', before: { km: 49000, at: '2026-11-02T18:00:00Z' }, after: null }, error: null });
    open();
    typeRow('LUR247', '4810');
    fireEvent.click(screen.getByRole('button', { name: /^Save to/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/read 49,000, higher than this/);
    fireEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(rpc).toHaveBeenLastCalledWith('record_sheet_odometer', expect.objectContaining({ p_km: 4810, p_force: true })));
  });

  it('no car, or an odo that is not one: Save stays off', () => {
    open();
    typeRow('ZZZ999', '48100');
    expect(screen.getByText('FG has no car by that plate or unit.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Save to/ })).toBeDisabled();
    typeRow('LUR247', '48.1');
    expect(screen.getByRole('button', { name: /^Save to/ })).toBeDisabled();
  });

  it('a row that could not reach FG offers Try again', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    open();
    typeRow('LUR247', '48100');
    fireEvent.click(screen.getByRole('button', { name: /^Save to/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(rpc).toHaveBeenCalledTimes(2));
  });

  it('⭐ the photo pins above the rows, from the phone only, and zooms', () => {
    const made = vi.fn(() => 'blob:sheet');
    vi.stubGlobal('URL', { ...URL, createObjectURL: made, revokeObjectURL: vi.fn() });
    open();
    fireEvent.change(screen.getByLabelText('Sheet photo'), { target: { files: [new File(['x'], 'sat.jpg', { type: 'image/jpeg' })] } });
    const img = screen.getByAltText('The gas sheet') as HTMLImageElement;
    expect(img.src).toBe('blob:sheet');
    expect(rpc).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Zoom' }));
    expect(img.className).toContain('w-[250%]');
    vi.unstubAllGlobals();
  });
});
