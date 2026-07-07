import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the write modules so we don't touch supabase/env — we're testing the hook's
// batch/error contract, not the DB.
vi.mock('../../src/lib/vsaTripWrite', () => ({ writeOrEnqueue: vi.fn() }));
vi.mock('../../src/lib/addWhiteboardReminder', () => ({ addWhiteboardReminder: vi.fn() }));

import { useProposalConfirm } from '../../src/hooks/useProposalConfirm';
import { writeOrEnqueue } from '../../src/lib/vsaTripWrite';
import type { OverflowLogProposal } from '../../api/_lib/overflowProposal';
import type { HoldProposal } from '../../api/_lib/holdProposal';

const mockWrite = vi.mocked(writeOrEnqueue);

// deps are passed in (the hook uses `import type` for context, so no provider needed).
const deps = {
  user: { id: 'u1', branchId: 'YWG', name: 'Aaron', role: 'VSA' },
  messages: [],
  addHold: vi.fn(),
  addVehicle: vi.fn(),
  setCoverPhoto: vi.fn(),
  addLostFoundItem: vi.fn(),
  effieMemory: { add: vi.fn() },
  onNavigate: vi.fn(),
  setOpen: vi.fn(),
} as unknown as Parameters<typeof useProposalConfirm>[0];

const overflow = (): OverflowLogProposal => ({
  kind: 'overflow_log',
  destination: 'AV Flight',
  vehicles: [
    { plate: 'LFJ379', unit: null, label: 'LFJ379', unresolved: false },
    { plate: 'LUR175', unit: null, label: 'LUR175', unresolved: false },
  ],
});

describe('useProposalConfirm — overflow_log branch', () => {
  beforeEach(() => mockWrite.mockReset());

  it('logs exactly one trip per vehicle in the batch', async () => {
    mockWrite.mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useProposalConfirm(deps));
    await result.current(overflow());
    expect(mockWrite).toHaveBeenCalledTimes(2);
    expect(mockWrite).toHaveBeenCalledWith('insert', expect.objectContaining({ arrive_location: 'AV Flight', one_way: true }));
  });

  it('throws when any write in the batch fails, so the card surfaces the error', async () => {
    mockWrite.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    const { result } = renderHook(() => useProposalConfirm(deps));
    await expect(result.current(overflow())).rejects.toThrow(/could not log/i);
  });
});

describe('useProposalConfirm — register_vehicle branch', () => {
  it('registers a new-to-fleet vehicle with NO hold', async () => {
    const addVehicle = vi.fn().mockResolvedValue('veh-1');
    const addHold = vi.fn();
    const { result } = renderHook(() =>
      useProposalConfirm({ ...deps, addVehicle, addHold } as unknown as Parameters<typeof useProposalConfirm>[0]),
    );
    await result.current({
      kind: 'register_vehicle',
      isTesla: false,
      newVehicle: { unitNumber: '5427620', plate: 'LJF723', make: 'Kia', model: 'Sportage Hybrid', year: 2026, color: 'Gray' },
    });
    expect(addVehicle).toHaveBeenCalledWith(
      // status CLEAR is load-bearing: no hold is added, so it must NOT default to HELD.
      // A non-Tesla leaves the EV-asset fields null (unknown) — the card never asked.
      expect.objectContaining({ licensePlate: 'LJF723', make: 'Kia', model: 'Sportage Hybrid', isTesla: false, status: 'CLEAR', hasMobileCable: null, hasJ1772Adapter: null }),
    );
    expect(addHold).not.toHaveBeenCalled();
  });

  it('threads the tapped Tesla asset choice into addVehicle', async () => {
    const addVehicle = vi.fn().mockResolvedValue('veh-2');
    const addHold = vi.fn();
    const { result } = renderHook(() =>
      useProposalConfirm({ ...deps, addVehicle, addHold } as unknown as Parameters<typeof useProposalConfirm>[0]),
    );
    // Cable present, adapter missing — the presence the operator tapped on the card.
    await result.current(
      {
        kind: 'register_vehicle',
        isTesla: true,
        newVehicle: { unitNumber: '5421', plate: 'HFE872', make: 'Tesla', model: 'Model 3', year: 2024, color: 'White' },
      },
      { cable: true, adapter: false },
    );
    expect(addVehicle).toHaveBeenCalledWith(
      expect.objectContaining({ licensePlate: 'HFE872', isTesla: true, status: 'CLEAR', hasMobileCable: true, hasJ1772Adapter: false }),
    );
    expect(addHold).not.toHaveBeenCalled();
  });
});

describe('useProposalConfirm — hold provenance', () => {
  it('stamps an Effie-written hold with flaggedSource "effie"', async () => {
    const addHold = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useProposalConfirm({ ...deps, addHold } as unknown as Parameters<typeof useProposalConfirm>[0]),
    );
    const hold: HoldProposal = {
      kind: 'hold',
      vehicle: { vehicleId: 'veh-1', plate: 'LUR187', label: 'Unit 1234' },
      holdType: 'damage',
      damageDescription: 'bumper scuff',
    };
    await result.current(hold);
    // 10th positional arg = flaggedSource — Effie-origin so the record shows "· via Effie".
    expect(addHold).toHaveBeenCalledWith('veh-1', 'bumper scuff', '', 'u1', undefined, ['damage'], undefined, undefined, undefined, 'effie');
  });
});
