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

  // ⭐ 2026-10-21: *"I like the big in your face hard to miss notice… the no keytag should get the same treatment
  // too"*, and *"Without the button. I can use what we already have"*. A box, not an 11px line, and it points at
  // the sheet's own 📷 Scan a tag rather than adding a second one.
  it('⭐ is a box you cannot miss, pointing at the Scan a tag button — with no button of its own', () => {
    renderCard(rogue);
    const box = screen.getByTestId('scan-keytag-missing');
    expect(box).toHaveTextContent(/no key tag photo on file/i);
    expect(box).toHaveTextContent('📷 Scan a tag');
    expect(box.querySelector('button')).toBeNull();
  });

  it('is not there when the car already has its tag photo', () => {
    renderCard({ ...rogue, keytagPhotoUrl: 'https://x/tag.jpg' } as Vehicle);
    expect(screen.queryByTestId('scan-keytag-missing')).toBeNull();
  });
});
