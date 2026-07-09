import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { PendingWritesSection } from '../../src/components/pending/PendingWritesSection';
import type { PendingWrite } from '../../src/hooks/usePendingWrites';

// Graduated-autonomy L1 (docs/ticket-misc-effie-graduated-autonomy.md): the queue flags the
// "safe set" (backfills) and bulk-clears them. isFastTrackSafe is unit-tested; this locks the
// SURFACE wiring — which rows get the badge, that "Approve all safe" clears ONLY the safe ones
// (a register is left for individual eyes), and that it runs through the guarded approve.
const markResolved = vi.fn().mockResolvedValue(true);
const confirmProposal = vi.fn().mockResolvedValue(undefined);

const backfill: PendingWrite = {
  id: 'pw-backfill', kind: 'update_vehicle', source: 'keytag-scan', createdAt: '2026-07-09T00:00:00Z',
  proposal: { kind: 'update_vehicle', vehicleId: 'v1', plate: 'LUR554', fills: [{ field: 'color', value: 'Gray' }] },
};
const register: PendingWrite = {
  id: 'pw-register', kind: 'register_vehicle', source: 'keytag-scan', createdAt: '2026-07-09T00:00:00Z',
  proposal: { kind: 'register_vehicle', newVehicle: { unitNumber: '9001', plate: 'LUR187', make: 'Ford', model: 'Escape', year: 2024, color: 'Blue' }, isTesla: false },
};

vi.mock('../../src/hooks/usePendingWrites', () => ({
  usePendingWrites: () => ({ pending: [backfill, register], markResolved, stage: vi.fn(), reload: vi.fn() }),
}));
vi.mock('../../src/hooks/useProposalConfirm', () => ({ useProposalConfirm: () => confirmProposal }));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', name: 'Aaron' } }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ addHold: vi.fn(), addVehicle: vi.fn(), updateVehicleFields: vi.fn(), setCoverPhoto: vi.fn() }),
}));
vi.mock('../../src/context/LostFoundContext', () => ({ useLostFoundContext: () => ({ addLostFoundItem: vi.fn() }) }));
vi.mock('../../src/hooks/useEffieMemory', () => ({ useEffieMemory: () => ({ add: vi.fn() }) }));

beforeEach(() => { markResolved.mockClear(); confirmProposal.mockClear(); });

describe('PendingWritesSection — fast-track', () => {
  it('offers "Approve all safe" for the backfill only (the register is not safe)', () => {
    render(<PendingWritesSection />);
    expect(screen.getByText(/Approve all safe \(1\)/)).toBeInTheDocument();
    // Exactly one row carries the safe badge.
    expect(screen.getAllByText(/Safe to fast-track/)).toHaveLength(1);
  });

  it('bulk-approving clears ONLY the safe backfill through the guarded approve, leaving the register', async () => {
    render(<PendingWritesSection />);
    fireEvent.click(screen.getByText(/Approve all safe \(1\)/));
    await waitFor(() => expect(markResolved).toHaveBeenCalledWith('pw-backfill', 'approved'));
    // The register was never touched by the bulk pass.
    expect(markResolved).not.toHaveBeenCalledWith('pw-register', 'approved');
    expect(confirmProposal).toHaveBeenCalledTimes(1);
    expect(confirmProposal).toHaveBeenCalledWith(backfill.proposal, undefined, []);
  });
});
