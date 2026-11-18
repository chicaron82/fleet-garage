import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Find a car's card offers Restore under "Not in the fleet" when FG holds the car archived
// (docs/ticket-recent-cars-everywhere-and-restore-from-find.md). Aaron, 2026-11-18: *"I think the find a car should be
// able to view and have the option to restore an archived vehicle"*. The offer's own behaviour is in
// ScanArchivedOffer.test.tsx; this pins that the CARD shows it, with the plate he searched.

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1', role: 'VSA', branchId: 'YWG' } }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    holds: [], recordKeyCount: vi.fn(), recordOdometer: vi.fn(), clearOdometer: vi.fn(),
    correctOdometer: vi.fn(), updateVehicleEVAssets: vi.fn(), adoptPlate: vi.fn(), retakeKeytagPhoto: vi.fn(),
    archivedVehicles: [{ id: 'v357', licensePlate: 'LUR357', unitNumber: '5422464', archivedAt: '2026-11-01T01:45:08Z' }],
    restoreVehicle: vi.fn(async () => true),
  }),
}));

import { ScanIdentityCard } from '../../src/components/scan-router/ScanIdentityCard';

function renderCard(plate: string, onRestored?: (id: string) => void) {
  return render(
    <ScanIdentityCard
      scanRead={{ plate, unitNumber: '' } as never}
      result={{ rawPlate: plate, plate, wasCorrected: false, vehicle: null, noIdentityKey: false, matchedByUnit: false, unitCandidates: [] } as never}
      holdLines={[]}
      scanNonce={1}
      canRegister
      onPickCandidate={vi.fn()}
      onRestored={onRestored}
      geotabPending={false}
      scanPhoto={null}
      backfillToast={null}
      conflictToast={null}
      codexToast=""
    />,
  );
}

describe('ScanIdentityCard — an archived car is not a stranger', () => {
  it('⭐ "Not in the fleet" about an archived car comes with its Restore', () => {
    renderCard('LUR357', vi.fn());
    expect(screen.getByText(/Not in the fleet/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Restore to fleet/ })).toBeInTheDocument();
  });

  it('a plate FG never had: no offer, the card reads as it always did', () => {
    renderCard('ZZZ999', vi.fn());
    expect(screen.queryByRole('button', { name: /Restore to fleet/ })).toBeNull();
  });
});
