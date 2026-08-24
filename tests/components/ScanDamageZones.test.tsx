import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScanDamageZones } from '../../src/components/scan-router/ScanDamageZones';
import type { Hold } from '../../src/types';

const hold = (over: Partial<Hold> & { id: string; vehicleId: string }): Hold =>
  ({ status: 'ACTIVE', holdTypes: ['damage'], notes: '', flaggedAt: '2026-08-20T12:00:00Z',
     damageZones: [], ...over } as unknown as Hold);

describe('ScanDamageZones — where the damage is, at the scan', () => {
  it('⚠️ shows ONLY the scanned car\'s panels, never a neighbour\'s', () => {
    // The oldest scar in this repo: the scan-router surfacing the PREVIOUS car's data. Getting this
    // filter wrong would put someone else's damage on the slip he is about to fill in by hand.
    render(<ScanDamageZones vehicleId="v-mine" holds={[
      hold({ id: 'h1', vehicleId: 'v-mine',  damageZones: ['front-bumper'] }),
      hold({ id: 'h2', vehicleId: 'v-other', damageZones: ['trunk-liftgate'] }),
    ]} />);
    expect(screen.getByText('Front bumper')).toBeTruthy();
    expect(screen.queryByText('Trunk / liftgate')).toBeNull();
  });

  it('says nothing at all when no panel is recorded — most scans are clear cars', () => {
    const { container } = render(<ScanDamageZones vehicleId="v-mine" holds={[
      hold({ id: 'h1', vehicleId: 'v-mine' }),                      // a hold, but untagged
    ]} />);
    expect(container.firstChild).toBeNull();
  });

  it('stays silent for a car with no holds at all', () => {
    const { container } = render(<ScanDamageZones vehicleId="v-mine" holds={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('gathers every panel across the car\'s several holds, and draws the diagram', () => {
    render(<ScanDamageZones vehicleId="v-mine" holds={[
      hold({ id: 'h1', vehicleId: 'v-mine', damageZones: ['front-bumper'] }),
      hold({ id: 'h2', vehicleId: 'v-mine', damageZones: ['driver-rear-door'] }),
    ]} />);
    expect(screen.getByText('Front bumper')).toBeTruthy();
    expect(screen.getByText('Driver rear door')).toBeTruthy();
    expect(screen.getByTestId('damage-zone-map')).toBeTruthy();
  });

  it('a repaired hold\'s panel is gone — the car is clear there now', () => {
    const { container } = render(<ScanDamageZones vehicleId="v-mine" holds={[
      hold({ id: 'h1', vehicleId: 'v-mine', status: 'REPAIRED', damageZones: ['front-bumper'] }),
    ]} />);
    expect(container.firstChild).toBeNull();
  });
});
