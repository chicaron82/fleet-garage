// The car edit (✏️) used to close on ANY save, landed or not: `directEditVehicleIdentity` threw away
// the write's `ok`. Found 2026-10-09 while wiring the attach-unit offer onto the same function.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VehicleDirectEditModal } from '../../src/components/vehicle/VehicleDirectEditModal';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn() }));

const PROPS = {
  vehicleId: 'v-1', initialUnitNumber: '5428263', initialLicensePlate: 'KGE609',
  initialMake: 'Dodge', initialModel: 'Ram 1500', initialYear: 2026, initialColor: 'White',
  initialRentalClass: null, onUnlockField: vi.fn().mockResolvedValue(undefined),
};

describe('VehicleDirectEditModal — a save that did not land', () => {
  it('stays open and says so', async () => {
    const onClose = vi.fn();
    const edit = vi.fn().mockResolvedValue(false);
    render(<VehicleDirectEditModal {...PROPS} onClose={onClose} directEditVehicleIdentity={edit} />);
    expect(screen.queryByRole('alert')).toBeNull();      // control: no claim before a save is tried
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/didn't save/i);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes when the save lands', async () => {
    const onClose = vi.fn();
    const edit = vi.fn().mockResolvedValue(true);
    render(<VehicleDirectEditModal {...PROPS} onClose={onClose} directEditVehicleIdentity={edit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

// ⭐ Aaron, 2026-10-15, on LJF692: he knew make, model, code and class off the Taos block around it, but
// not the colour, and Save stayed greyed with no reason. And 10-17: SB183H, a 2022 Tesla ("CM3L 22" on
// the tag) with a blank year, was saved as 2026 because the stepper seeded the current year.
describe('VehicleDirectEditModal — a partial identity', () => {
  const partial = { ...PROPS, initialMake: '', initialModel: '', initialYear: 0, initialColor: '' };

  it('⭐ an unknown year shows "Not known" and is sent as 0, never as this year', async () => {
    const edit = vi.fn().mockResolvedValue(true);
    render(<VehicleDirectEditModal {...PROPS} initialYear={0} onClose={vi.fn()} directEditVehicleIdentity={edit} />);
    expect(screen.getByText('Not known')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][3]).toMatchObject({ year: 0 });
  });

  it('a real year is kept as it was', async () => {
    const edit = vi.fn().mockResolvedValue(true);
    render(<VehicleDirectEditModal {...PROPS} initialYear={2022} onClose={vi.fn()} directEditVehicleIdentity={edit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(edit).toHaveBeenCalled());
    expect(edit.mock.calls[0][3]).toMatchObject({ year: 2022 });
  });

  it('⭐ no colour: Save still works once make and model are set', () => {
    render(<VehicleDirectEditModal {...partial} onClose={vi.fn()} directEditVehicleIdentity={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true); // control: nothing known yet
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Volkswagen' } });
    fireEvent.change(screen.getAllByRole('combobox')[1], { target: { value: 'Taos' } });
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('stepping an unknown year starts from this year', () => {
    render(<VehicleDirectEditModal {...partial} onClose={vi.fn()} directEditVehicleIdentity={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Year down' }));
    expect(screen.getByText(String(new Date().getFullYear()))).toBeTruthy();
  });
});
