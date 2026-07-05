import { renderHook } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock the write modules so we don't touch supabase/env — we're testing the hook's
// batch/error contract, not the DB.
vi.mock('../../src/lib/vsaTripWrite', () => ({ writeOrEnqueue: vi.fn() }));
vi.mock('../../src/lib/addWhiteboardReminder', () => ({ addWhiteboardReminder: vi.fn() }));

import { useProposalConfirm } from '../../src/hooks/useProposalConfirm';
import { writeOrEnqueue } from '../../src/lib/vsaTripWrite';
import type { OverflowLogProposal } from '../../api/_lib/overflowProposal';

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
      newVehicle: { unitNumber: '5427620', plate: 'LJF723', make: 'Kia', model: 'Sportage Hybrid', year: 2026, color: 'Gray' },
    });
    expect(addVehicle).toHaveBeenCalledWith(
      // status CLEAR is load-bearing: no hold is added, so it must NOT default to HELD.
      expect.objectContaining({ licensePlate: 'LJF723', make: 'Kia', model: 'Sportage Hybrid', isTesla: false, status: 'CLEAR' }),
    );
    expect(addHold).not.toHaveBeenCalled();
  });
});
