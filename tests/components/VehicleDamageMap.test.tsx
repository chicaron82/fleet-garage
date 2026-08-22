import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { VehicleDamageMap } from '../../src/components/vehicle/VehicleDamageMap';
import type { Hold, HoldStatus } from '../../src/types';

// The at-a-glance reference above the hold history (docs/ticket-damage-zones.md, phase 2b).
// Aaron reads this while filling the paper inspection slip, so what it says about a RELEASED
// hold is not cosmetic — it decides whether he circles a panel that really is damaged.

const hold = (status: HoldStatus, damageZones: string[], flaggedAt = '2026-08-01T00:00:00Z'): Hold => ({
  id: `h-${status}-${damageZones.join('')}`, vehicleId: 'veh-1',
  holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription: 'Scratch — paint surface',
  flaggedById: 'u-1', flaggedByName: 'Aaron S.', flaggedByEmployeeId: '331965',
  flaggedAt, notes: '', status, branchId: 'YWG', damageZones,
});

const zone = (id: string) => document.querySelector(`[data-zone="${id}"]`)!;

describe('VehicleDamageMap', () => {
  it('⭐ keeps a RELEASED pre-existing panel lit — the damage is still on the car', () => {
    render(<VehicleDamageMap holds={[hold('RELEASED', ['front-bumper'])]} />);
    expect(screen.getByText('Front bumper')).toBeInTheDocument();
    expect(zone('front-bumper')).toHaveAttribute('aria-checked', 'true');
  });

  it('drops a panel once its hold is repaired', () => {
    render(<VehicleDamageMap holds={[hold('REPAIRED', ['hood'])]} />);
    expect(screen.getByText(/No damage zones recorded/)).toBeInTheDocument();
    // Nothing standing → no diagram at all. A blank car outline says less than the sentence does,
    // and costs vertical space above the history he is actually reaching for.
    expect(screen.queryByTestId('damage-zone-map')).toBeNull();
    expect(screen.queryByText('Hood')).toBeNull();
  });

  it('merges several standing holds and dates the most recent', () => {
    render(<VehicleDamageMap holds={[
      hold('ACTIVE', ['roof'], '2026-07-01T00:00:00Z'),
      hold('RELEASED', ['rear-bumper'], '2026-08-21T14:17:00Z'),
    ]} />);
    expect(screen.getByText('Roof')).toBeInTheDocument();
    expect(screen.getByText('Rear bumper')).toBeInTheDocument();
    expect(screen.getByText('last flagged 2026-08-21')).toBeInTheDocument();
  });

  it('says nothing is recorded rather than showing a blank card', () => {
    render(<VehicleDamageMap holds={[]} />);
    expect(screen.getByText(/No damage zones recorded/)).toBeInTheDocument();
    expect(screen.queryByText(/last flagged/)).toBeNull();
  });

  it('⭐ is read-only — a tap here must not edit anything', () => {
    // Tagging belongs to a hold; a panel means nothing without the record that explains it.
    render(<VehicleDamageMap holds={[hold('ACTIVE', ['hood'])]} />);
    expect(zone('hood')).toHaveAttribute('aria-disabled', 'true');
  });
});
