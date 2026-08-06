import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldHistorySection } from '../../src/components/holds/HoldHistorySection';
import type { Hold, HoldType } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({
  hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn(),
}));
// HoldRecordCard (the extracted per-hold card) pulls the destructive edit ops from
// context; this test doesn't wrap a provider, so stub it.
vi.mock('../../src/context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u-1', employeeId: 'E1', name: 'Test VSA', role: 'VSA', branchId: 'YWG' } }),
}));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ voidHold: vi.fn(), deleteHold: vi.fn(), deleteHoldPhoto: vi.fn() }),
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
  vehicle: {
    id: 'v-1', unitNumber: '5421433', branchId: 'YWG' as const, coverPhotoUrl: undefined,
    // Vehicle status decides whether a RETURNED hold still reads as owing a re-eval — see
    // the grouping suite below and lib/holdGrouping.
    status: 'HELD' as const,
  },
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

// Aaron, reading unit 5423777 on the lot: "I read it as if it still needs a geotab... it should
// make it clear that it's done and the only hold it has is the cracked windshield."
describe('HoldHistorySection — action vs no-action grouping', () => {
  function namedHold(id: string, description: string, status: Hold['status']): Hold {
    return { ...hold(['damage'], []), id, damageDescription: description, status };
  }

  it('splits the live 5423777 case — windshield still open, geotab closed', () => {
    render(<HoldHistorySection {...PROPS} holds={[
      namedHold('h-glass', 'Cracked windshield', 'ACTIVE'),
      namedHold('h-geotab', 'Geotab not installed', 'RETURNED'),
    ]} />);
    expect(screen.getByText('Needs action · 1')).toBeTruthy();
    expect(screen.getByText('No action needed · 1')).toBeTruthy();
    // both records remain on the page — closed recedes, it never disappears
    expect(screen.getByText('Cracked windshield')).toBeTruthy();
    expect(screen.getByText('Geotab not installed')).toBeTruthy();
  });

  it('shows no action group when every hold is resolved', () => {
    render(<HoldHistorySection {...PROPS} holds={[namedHold('h1', 'Old damage', 'REPAIRED')]} />);
    expect(screen.queryByText(/Needs action/)).toBeNull();
    expect(screen.getByText('No action needed · 1')).toBeTruthy();
  });

  // Aaron on unit 5424395: "not counting pre-existing and sale flags as part of the open count."
  it('keeps an ACTIVE sale flag out of the action group — it is a classification, not work', () => {
    const sale = { ...hold(['sale_car'], []), id: 'h-sale', damageDescription: 'Sale car' };
    render(<HoldHistorySection {...PROPS} holds={[sale]} />);
    expect(screen.queryByText(/Needs action/)).toBeNull();
    expect(screen.getByText('No action needed · 1')).toBeTruthy();
    expect(screen.getByText('Sale car')).toBeTruthy();   // still on the record
  });

  // A returned hold is only past once the vehicle has moved on; while it is still RETURNED the
  // re-evaluation is owed, so the hold must stay surfaced.
  it('keeps a RETURNED hold open while the vehicle still owes a re-eval', () => {
    const props = { ...PROPS, vehicle: { ...PROPS.vehicle, status: 'RETURNED' as const } };
    render(<HoldHistorySection {...props} holds={[namedHold('h1', 'Geotab not installed', 'RETURNED')]} />);
    expect(screen.getByText('Needs action · 1')).toBeTruthy();
    expect(screen.queryByText(/No action needed ·/)).toBeNull();
  });

  it('still shows the clean-history empty state with no holds', () => {
    render(<HoldHistorySection {...PROPS} holds={[]} />);
    expect(screen.getByText(/Clean history/)).toBeTruthy();
    expect(screen.queryByText(/Needs action/)).toBeNull();
    expect(screen.queryByText(/No action needed ·/)).toBeNull();
  });
});
