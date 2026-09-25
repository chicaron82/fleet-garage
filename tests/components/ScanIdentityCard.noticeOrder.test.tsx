import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Vehicle } from '../../src/types';

// ⭐ Aaron, 2026-09-24, typing LUR345 into Find a car: *"I didn't realize it needed a keytag photo until
// scrolling."* The notices — the lines that ask him to do something while the tag is in his hand —
// rendered at the very END of the card, below holds, damage map, keys and odometer.
// docs/September/ticket-tag-notice-above-the-fold.md

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    holds: [], recordKeyCount: vi.fn(), recordOdometer: vi.fn(), clearOdometer: vi.fn(),
    correctOdometer: vi.fn(), updateVehicleEVAssets: vi.fn(), adoptPlate: vi.fn(), retakeKeytagPhoto: vi.fn(),
  }),
}));

import { ScanIdentityCard } from '../../src/components/scan-router/ScanIdentityCard';

const rogue = {
  id: 'v1', licensePlate: 'LUR345', unitNumber: '5422381', make: 'Nissan', model: 'Rogue', year: 2026,
  color: 'Gray', status: 'HELD', branchId: 'YWG', keytagPhotoUrl: undefined,
} as unknown as Vehicle;

const holdLines = [{
  id: 'h1', typeLabel: 'Mechanical', typeEmoji: '🛞', detail: 'Low tread', cycles: 1,
  firstFlaggedAt: '2026-09-24T14:00:00Z', lastFlaggedAt: '2026-09-24T14:00:00Z', zones: [],
}];

function renderCard(vehicle: Vehicle | null) {
  return render(
    <ScanIdentityCard
      scanRead={null}
      result={{ rawPlate: 'LUR345', plate: 'LUR345', wasCorrected: false, vehicle, noIdentityKey: false,
        matchedByUnit: false } as never}
      holdLines={holdLines as never}
      scanNonce={1}
      canRegister={false}
      onPickCandidate={vi.fn()}
      geotabPending={false}
      scanPhoto={null}
      backfillToast={null}
      conflictToast={null}
      codexToast=""
    />,
  );
}

describe('ScanIdentityCard — the tag notice is seen before the holds', () => {
  it('⭐ on a found car, "No key tag photo" renders ABOVE the first hold line', () => {
    renderCard(rogue);
    const notice = screen.getByText(/no key tag photo on file/i);
    const hold = screen.getByText(/low tread/i);
    // DOCUMENT_POSITION_FOLLOWING: the hold comes AFTER the notice.
    expect(notice.compareDocumentPosition(hold) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('renders the notices exactly once', () => {
    renderCard(rogue);
    expect(screen.getAllByText(/no key tag photo on file/i)).toHaveLength(1);
  });
});
