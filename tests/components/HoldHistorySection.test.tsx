import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldHistorySection } from '../../src/components/holds/HoldHistorySection';
import type { Hold, HoldType } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
}));

function hold(holdTypes: HoldType[], resolvedTypes: HoldType[]): Hold {
  return {
    id: 'hold-1', vehicleId: 'v-1',
    holdTypes, holdType: holdTypes[0]!, resolvedTypes,
    damageDescription: 'CX-5 front bumper + check engine light',
    flaggedById: 'u1', flaggedByName: 'Test VSA', flaggedByEmployeeId: 'E1',
    flaggedAt: '2026-06-01T10:00:00.000Z', notes: '',
    status: 'ACTIVE', branchId: 'YWG',
  };
}

const PROPS = {
  vehicle: { id: 'v-1', unitNumber: '5421433', branchId: 'YWG', coverPhotoUrl: null },
  showHoldPicker: false, repairableHolds: [], closeHoldPicker: vi.fn(),
  toggleRepairPick: vi.fn(), pickedForRepair: [], confirmRepairSelection: vi.fn(),
  showReleasePicker: false, activeHolds: [], closeReleasePicker: vi.fn(),
  pickHoldForRelease: vi.fn(), uploadingFor: null, addPhotoClick: vi.fn(),
  handlePhotoSelected: vi.fn(), openLightbox: vi.fn(),
  setCoverPhoto: vi.fn().mockResolvedValue(undefined),
  getName: () => 'Test User', getEmpId: () => 'E1', getRole: () => 'VSA',
};

describe('HoldHistorySection — resolution-aware badge & pills', () => {
  it('a 2-type hold with both types open shows Multi-Hold + both pills', () => {
    render(<HoldHistorySection {...PROPS} holds={[hold(['damage', 'mechanical'], [])]} />);
    expect(screen.getByText('Multi-Hold')).toBeTruthy();
    expect(screen.getByText('Mechanical')).toBeTruthy();
    expect(screen.getByText('Damage')).toBeTruthy();
  });

  it('with mechanical resolved, drops Multi-Hold + the Mechanical pill — only damage remains', () => {
    render(<HoldHistorySection {...PROPS} holds={[hold(['damage', 'mechanical'], ['mechanical'])]} />);
    expect(screen.queryByText('Multi-Hold')).toBeNull();
    expect(screen.queryByText('Mechanical')).toBeNull();
    // damage-only remainder shows no type pill (damage is the implied default) but the record stays
    expect(screen.getByText('CX-5 front bumper + check engine light')).toBeTruthy();
  });

  it('hides the mechanical sub-type pill (tire swap) once mechanical is resolved', () => {
    const h = { ...hold(['damage', 'mechanical'], ['mechanical']), mechanicalSubType: 'tire-swap' as const };
    render(<HoldHistorySection {...PROPS} holds={[h]} />);
    expect(screen.queryByText(/Tire Swap/)).toBeNull();
  });
});
