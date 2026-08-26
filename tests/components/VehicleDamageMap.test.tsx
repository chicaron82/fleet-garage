import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
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

  // ⭐⭐ THIS TEST CHANGED ON 2026-08-25, AND THE REASON MATTERS. It used to assert
  // `aria-disabled="true"` on the panel — the mechanism that happened to enforce read-only while
  // the diagram was an untappable picture. Tapping now OPENS THE DAMAGE PHOTO, so that attribute is
  // gone and the old assertion fails.
  //
  // The INTENT is unchanged and still worth guarding: reporting and editing are different axes, and
  // this surface must never write a zone. So the guard now asserts the property instead of the
  // proxy — tap a panel and the RECORD is untouched. Weakening this to "it renders" would be
  // deleting a guard to make a change pass; asserting the record is what the guard was always for.
  it('⭐ a tap READS — it must never edit the record', () => {
    render(<VehicleDamageMap holds={[hold('ACTIVE', ['hood'])]} />);
    fireEvent.click(zone('hood'));
    // The evidence opened…
    expect(screen.getByTestId('zone-evidence')).toBeInTheDocument();
    // …and the car's damage is exactly what it was: hood still lit, nothing else newly tagged.
    expect(zone('hood')).toHaveAttribute('aria-checked', 'true');
    expect(document.querySelectorAll('[aria-checked="true"]')).toHaveLength(1);
    // …and the drawer names the panel it belongs to, so the diagram and the text refer to the
    // same thing. (Scoped: 'Hood' legitimately appears twice — the chip above and this heading.)
    expect(within(screen.getByTestId('zone-evidence')).getByText('Hood')).toBeInTheDocument();
  });

  // ⚠️ An unpainted panel carries nothing, so it must stay INERT rather than opening an empty
  // drawer — a tap that produces a blank box reads as broken software.
  it('a panel with no damage does not open anything', () => {
    render(<VehicleDamageMap holds={[hold('ACTIVE', ['hood'])]} />);
    fireEvent.click(zone('roof'));
    expect(screen.queryByTestId('zone-evidence')).toBeNull();
  });
});
