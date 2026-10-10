import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AttachUnitNotice } from '../../src/components/vehicle/AttachUnitNotice';
import type { Vehicle } from '../../src/types';

const existing: Vehicle = {
  id: 'geotab-veh-KGE609', unitNumber: null, licensePlate: 'KGE609', make: '', model: '', year: 0, color: '',
  status: 'CLEAR', branchId: 'YWG', isTesla: false, hasMobileCable: null, hasJ1772Adapter: null,
};
const form = { unit: '5428263', make: '', model: '', year: 2026, color: '', rentalClass: '', classCode: '', isHybrid: false };

describe('AttachUnitNotice', () => {
  it('adds the unit to the EXISTING record and goes to it — no second car', async () => {
    const edit = vi.fn().mockResolvedValue(true);
    const onDone = vi.fn();
    render(<AttachUnitNotice existing={existing} form={form} directEditVehicleIdentity={edit} onDone={onDone} />);
    expect(screen.getByText(/KGE609 is already on file with no unit number/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add unit 5428263 to KGE609' }));
    await waitFor(() => expect(onDone).toHaveBeenCalledWith('geotab-veh-KGE609'));
    expect(edit).toHaveBeenCalledWith('geotab-veh-KGE609', '5428263', 'KGE609', undefined);
  });

  it('a save that fails says so and does not navigate', async () => {
    const edit = vi.fn().mockResolvedValue(false);
    const onDone = vi.fn();
    render(<AttachUnitNotice existing={existing} form={form} directEditVehicleIdentity={edit} onDone={onDone} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add unit 5428263 to KGE609' }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/didn't save/i);
    expect(onDone).not.toHaveBeenCalled();
  });
});
