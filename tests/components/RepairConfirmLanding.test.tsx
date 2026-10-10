// docs/October/ticket-the-confirm-says-clear-without-checking.md
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RepairConfirmSection } from '../../src/components/holds/RepairConfirmSection';
import type { Hold } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));

const hold = (id: string, flaggedAt = '2026-09-30T14:58:58.000Z'): Hold => ({
  id, vehicleId: 'v-1', holdTypes: ['hail'], holdType: 'hail', resolvedTypes: [],
  damageDescription: 'Hail damage', notes: '',
  flaggedById: 'u-1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E001',
  flaggedAt, status: 'ACTIVE', branchId: 'YWG',
});
const PROPS = {
  holds: [hold('sep')], repairNotes: '', setRepairNotes: vi.fn(), repairOutcome: 'clean' as const,
  setRepairOutcome: vi.fn(), repairing: false, onCancel: vi.fn(), onConfirm: vi.fn(),
};

describe('RepairConfirmSection — says where the car actually lands', () => {
  it('clear → promises Clear', () => {
    render(<RepairConfirmSection {...PROPS} landing={{ status: 'clear', closes: [] }} />);
    expect(screen.getByText(/will be set to/).textContent).toMatch(/Clear and returned to service/);
    expect(screen.queryByText(/Also closes/)).toBeNull();
  });

  it('another hold remains → does NOT promise Clear', () => {
    render(<RepairConfirmSection {...PROPS} landing={{ status: 'held', closes: [] }} />);
    expect(screen.queryByText(/will be set to/)).toBeNull();
    expect(screen.getByText(/another hold on this car is still open/)).toBeTruthy();
  });

  it('a linked re-hold → names the earlier release it closes', () => {
    render(<RepairConfirmSection {...PROPS}
      landing={{ status: 'clear', closes: [hold('aug', '2026-08-28T15:16:49.000Z')] }} />);
    expect(screen.getByText(/Also closes the release from Aug 28, 2026 for the same damage/)).toBeTruthy();
  });
});
