import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { Hold, Vehicle } from '../../src/types';
import { PendingApprovalsSection } from '../../src/components/my-shift/PendingApprovalsSection';

// Regression: holds load async. Seeding the panel's open-state from the mount-time
// pending.length left it stuck collapsed when the holds arrived after mount. It now
// defaults open whenever there are pendings (tracking the user's collapse intent).

const VEHICLE = { id: 'v1', unitNumber: '5753165', licensePlate: 'OES646' } as unknown as Vehicle;
const activeHold = {
  id: 'h1', vehicleId: 'v1', status: 'ACTIVE',
  flaggedAt: '2026-06-09T18:00:00.000Z', damageDescription: 'Windshield chip driver side',
} as unknown as Hold;
const noop = (id: string) => id;

describe('PendingApprovalsSection', () => {
  it('renders nothing while holds are still loading (empty)', () => {
    const { container } = render(
      <PendingApprovalsSection holds={[]} vehicles={[]} onSelectVehicle={noop} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('appears expanded when holds resolve after mount (regression: not stuck collapsed)', () => {
    const { rerender } = render(
      <PendingApprovalsSection holds={[]} vehicles={[]} onSelectVehicle={noop} />,
    );
    // Holds arrive from context after mount.
    rerender(
      <PendingApprovalsSection holds={[activeHold]} vehicles={[VEHICLE]} onSelectVehicle={noop} />,
    );
    expect(screen.getByText('Pending Approval')).toBeInTheDocument();
    // The list is expanded — a pending item's content is visible, not hidden behind a
    // frozen-collapsed gate.
    expect(screen.getByText(/Windshield chip/)).toBeInTheDocument();
    expect(screen.getByText('5753165')).toBeInTheDocument();
  });
});
