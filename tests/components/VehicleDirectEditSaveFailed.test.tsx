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
