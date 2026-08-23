import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Undoing a change-log entry. Built after a key-tag scan of LUR443 landed on LUR243's record and
// overwrote eleven fields; the log had every previous value and putting them back was hand work.

const revertVehicleChange = vi.fn().mockResolvedValue(undefined);
let ROWS: { changedAt: string; op: 'UPDATE' | 'DELETE'; changed: Record<string, unknown> }[] = [];

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ revertVehicleChange }),
}));
vi.mock('../../src/hooks/useVehicleChanges', () => ({ useVehicleChanges: () => ROWS }));
vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

import { VehicleChangeLog } from '../../src/components/vehicle/VehicleChangeLog';

const SCAN = {
  changedAt: '2026-08-22T20:30:00Z',
  op: 'UPDATE' as const,
  changed: { make: { from: 'Nissan', to: 'Dodge' }, model: { from: 'Versa', to: 'Durango' } },
};

const openLog = () => fireEvent.click(screen.getByRole('button', { name: /record change/i }));
beforeEach(() => { revertVehicleChange.mockClear(); revertVehicleChange.mockResolvedValue(undefined); });

describe('VehicleChangeLog — undo', () => {
  it('⭐ arms before it writes — one tap never reverts anything', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(revertVehicleChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /Undo these 2 changes\?/ })).toBeInTheDocument();
  });

  it('passes the entry through untouched on confirm', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    expect(revertVehicleChange).toHaveBeenCalledWith('veh-1', SCAN.changed, 'UPDATE');
  });

  it('can be backed out of', () => {
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    expect(revertVehicleChange).not.toHaveBeenCalled();
  });

  it('⭐⭐ SHOWS the refusal instead of swallowing it', () => {
    // "colour has changed since" is the useful half — it tells him someone corrected this after,
    // which is exactly the thing he needs to know before touching it again.
    revertVehicleChange.mockRejectedValueOnce(new Error('color has changed since — undoing this would overwrite that.'));
    ROWS = [SCAN];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    fireEvent.click(screen.getByRole('button', { name: /Undo these 2 changes\?/ }));
    return waitFor(() => expect(screen.getByText(/color has changed since/)).toBeInTheDocument());
  });

  it('offers nothing to undo on a DELETE entry', () => {
    ROWS = [{ changedAt: '2026-08-22T20:30:00Z', op: 'DELETE', changed: { make: 'Nissan', model: 'Versa' } }];
    render(<VehicleChangeLog vehicleId="veh-1" />);
    openLog();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('stays silent when the car has no trail at all', () => {
    ROWS = [];
    const { container } = render(<VehicleChangeLog vehicleId="veh-1" />);
    expect(container).toBeEmptyDOMElement();
  });
});
