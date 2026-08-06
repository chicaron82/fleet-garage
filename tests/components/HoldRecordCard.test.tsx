import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Hold, Vehicle } from '../../src/types';

// The destructive edit path (docs/ticket-holds-history-edit.md): edit → arm a delete/void
// → confirm → the matching context op fires with the right args. This is data deletion, so
// it earns a net beyond Aaron's manual taste (the R38 lesson).

const voidHold = vi.fn().mockResolvedValue(undefined);
const deleteHold = vi.fn().mockResolvedValue(undefined);
const deleteHoldPhoto = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ voidHold, deleteHold, deleteHoldPhoto }),
}));
// Isolate the edit controls — the footer/badge have their own render deps.
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', employeeId: 'E1', name: 'Test VSA', role: 'VSA', branchId: 'YWG' } }),
}));
vi.mock('../../src/components/holds/HoldRecordFooter', () => ({ HoldRecordFooter: () => null }));
vi.mock('../../src/components/holds/StatusBadge', () => ({ StatusBadge: () => null }));

import { HoldRecordCard } from '../../src/components/holds/HoldRecordCard';

const HOLD: Hold = {
  id: 'hold-1', vehicleId: 'veh-1',
  holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Hail dimpling on the roof',
  flaggedById: 'u-1', flaggedByName: 'Aaron S.', flaggedByEmployeeId: '331965',
  flaggedAt: '2026-07-08T19:20:00Z', notes: '', status: 'ACTIVE', branchId: 'YWG',
  photos: ['https://x/damage-photos/hold-1/keytag.jpg', 'https://x/damage-photos/hold-1/roof.jpg'],
};
const VEHICLE: Pick<Vehicle, 'id' | 'unitNumber' | 'branchId' | 'coverPhotoUrl'> = {
  id: 'veh-1', unitNumber: '5427802', branchId: 'YWG',
};

const passthrough = {
  vehicle: VEHICLE, uploadingFor: null, addPhotoClick: vi.fn(),
  cameraInputRef: { current: null }, galleryInputRef: { current: null },
  openLightbox: vi.fn(), setCoverPhoto: vi.fn().mockResolvedValue(undefined),
  getName: (_: string, s?: string) => s ?? '—', getEmpId: (_: string, s?: string) => s ?? '—',
  getRole: () => 'VSA', fmt: (s: string) => s, fmtDate: (s: string) => s,
};

beforeEach(() => { voidHold.mockClear(); deleteHold.mockClear(); deleteHoldPhoto.mockClear(); });

describe('HoldRecordCard — destructive edits', () => {
  it('hides the controls until you enter edit mode', () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    expect(screen.queryByText('Delete hold')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    expect(screen.getByText('Delete hold')).toBeInTheDocument();
    expect(screen.getByText('Void hold')).toBeInTheDocument();
  });

  it('delete needs a confirm, then fires deleteHold with the id', async () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    fireEvent.click(screen.getByText('Delete hold'));
    // Armed, not fired — a confirm is required.
    expect(deleteHold).not.toHaveBeenCalled();
    expect(screen.getByText(/Permanently delete this hold/)).toBeInTheDocument();
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(deleteHold).toHaveBeenCalledWith('hold-1'));
    expect(voidHold).not.toHaveBeenCalled();
  });

  it('cancel disarms without firing anything', () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    fireEvent.click(screen.getByText('Delete hold'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(deleteHold).not.toHaveBeenCalled();
    expect(screen.getByText('Delete hold')).toBeInTheDocument(); // back to the actions
  });

  it('void fires voidHold with the id', async () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    fireEvent.click(screen.getByText('Void hold'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(voidHold).toHaveBeenCalledWith('hold-1'));
  });

  it('marks a photo (no delete yet), then a single confirm batch-deletes it', async () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove this photo' })[0]); // mark keytag — grey
    expect(deleteHoldPhoto).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Delete 1 photo')); // commit → confirm
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() =>
      expect(deleteHoldPhoto).toHaveBeenCalledWith('hold-1', 'https://x/damage-photos/hold-1/keytag.jpg'));
  });

  it('tapping a marked photo again un-marks it (undo before commit)', () => {
    render(<HoldRecordCard hold={HOLD} {...passthrough} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit this hold' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove this photo' })[0]);
    expect(screen.getByText('Delete 1 photo')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo remove' }));
    expect(screen.queryByText(/Delete 1 photo/)).not.toBeInTheDocument();
    expect(deleteHoldPhoto).not.toHaveBeenCalled();
  });
});
