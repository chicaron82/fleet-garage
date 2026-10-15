import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Vehicle } from '../../src/types';

// Aaron, 2026-10-10, on LZM532 (hail: hood, roof, trunk): *"Move key count above damage map."* The
// map is tall; the keys sat under it, and so did four live write buttons his thumb passed on the way.
// docs/October/ticket-scan-card-header-chips.md

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn(), hapticMedium: vi.fn(), hapticHeavy: vi.fn() }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    holds: [{
      id: 'h1', vehicleId: 'v1', holdTypes: ['hail'], holdType: 'hail', resolvedTypes: [],
      damageDescription: 'Hail damage', damageZones: ['hood', 'roof'], status: 'RELEASED',
      flaggedAt: '2026-08-28T15:16:49.000Z', photos: [],
    }],
    recordKeyCount: vi.fn(), recordOdometer: vi.fn(), clearOdometer: vi.fn(),
    correctOdometer: vi.fn(), updateVehicleEVAssets: vi.fn(), adoptPlate: vi.fn(), retakeKeytagPhoto: vi.fn(),
  }),
}));

import { ScanIdentityCard } from '../../src/components/scan-router/ScanIdentityCard';

const elantra = {
  id: 'v1', licensePlate: 'LZM532', unitNumber: '5423132', make: 'Hyundai', model: 'Elantra', year: 2026,
  color: 'Blue', status: 'CLEAR', branchId: 'YWG', keyCount: 4, isTesla: false,
  keytagPhotoUrl: 'https://example.test/tag.jpg', odometer: 10930, odometerAt: '2026-10-09T15:00:00Z',
} as unknown as Vehicle;

const after = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;

function renderCard(onOpenVehicle = vi.fn()) {
  render(
    <ScanIdentityCard
      scanRead={null}
      result={{ rawPlate: 'LZM532', plate: 'LZM532', wasCorrected: false, vehicle: elantra, noIdentityKey: false,
        matchedByUnit: false, unitCandidates: [] } as never}
      holdLines={[]}
      scanNonce={1}
      canRegister={false}
      onPickCandidate={vi.fn()}
      onOpenVehicle={onOpenVehicle}
      geotabPending={false}
      scanPhoto={null}
      backfillToast={null}
      conflictToast={null}
      codexToast=""
    />,
  );
  return onOpenVehicle;
}

describe('ScanIdentityCard — keys read above the damage map', () => {
  it('⭐ the key chip comes BEFORE the map, and the odometer after it', () => {
    renderCard();
    const map = screen.getByTestId('scan-damage-zones');          // control: the map IS on this card
    const keys = screen.getByRole('button', { name: /🔑 4/ });
    expect(after(keys, map)).toBe(true);
    expect(after(map, screen.getByLabelText('Odometer reading'))).toBe(true);
  });

  // The old row rendered four buttons labelled "N keys on the ring". None may survive anywhere.
  it('⚠️ no always-live key-count button is left on the card', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /on the ring/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /🔑/ })).toHaveLength(1);
  });

  it('tapping the identity block calls the opener the overlay handed in', async () => {
    const user = userEvent.setup();
    const onOpen = renderCard();
    await user.click(screen.getByRole('button', { name: /LZM532 · Unit 542 3132/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
