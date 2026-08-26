import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { DamageZoneInspector } from '../../src/components/holds/DamageZoneInspector';
import { vehicleDamageZones } from '../../src/lib/damageZones';
import type { Hold, HoldStatus } from '../../src/types';

// Aaron, 2026-08-25: "i could tap the zone and it would show me the photo of the damage at that
// zone." The map answered WHERE since 2026-08-22 and never WHICH — and WHICH is what LUR184 cost.

const hold = (
  id: string, status: HoldStatus, damageZones: string[],
  photos: string[] = [], damageDescription = 'Scratch — paint surface',
  flaggedAt = '2026-08-01T00:00:00Z',
): Hold => ({
  id, vehicleId: 'veh-1', holdTypes: ['damage'], holdType: 'damage', resolvedTypes: [],
  damageDescription, flaggedById: 'u-1', flaggedByName: 'Aaron S.', flaggedByEmployeeId: '331965',
  flaggedAt, notes: '', status, branchId: 'YWG', damageZones, photos,
});

const zone = (id: string) => document.querySelector(`[data-zone="${id}"]`)!;
const paint = (holds: Hold[]) => vehicleDamageZones(holds).zones;

describe('DamageZoneInspector', () => {
  it('shows nothing until a panel is tapped', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    expect(screen.queryByTestId('zone-evidence')).toBeNull();
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a tap on a marked panel reveals the damage recorded there', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'], 'Dent above the grille')];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('hood'));
    const panel = within(screen.getByTestId('zone-evidence'));
    expect(panel.getByText('Hood')).toBeInTheDocument();
    expect(panel.getByText('Dent above the grille')).toBeInTheDocument();
    expect(panel.getByRole('img')).toHaveAttribute('src', 'p1.jpg');
  });

  // ⚠️⚠️ THE LUR184 CASE — the reason this feature exists at all. Three holds on that car all read
  // "Windshield chip"; the batch picker rendered the field they SHARED and withheld the two that
  // differed, so Aaron cleared all three and a live bumper scratch went off the record. If this
  // ever picks one hold for him, it has rebuilt that defect with a nicer surface.
  it('⭐⭐ shows EVERY hold on a contested panel, never one of them', () => {
    const holds = [
      hold('old', 'ACTIVE', ['rear-bumper'], ['old.jpg'], 'Windshield chip', '2026-07-01T00:00:00Z'),
      hold('new', 'ACTIVE', ['rear-bumper'], ['new.jpg'], 'Windshield chip', '2026-08-01T00:00:00Z'),
    ];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('rear-bumper'));
    const panel = within(screen.getByTestId('zone-evidence'));
    expect(panel.getAllByText('Windshield chip')).toHaveLength(2);
    // Both photos, newest first — the ONLY thing that tells two identical descriptions apart.
    expect(panel.getAllByRole('img').map(i => i.getAttribute('src'))).toEqual(['new.jpg', 'old.jpg']);
    expect(panel.getByText(/flagged 2026-08-01/)).toBeInTheDocument();
    expect(panel.getByText(/flagged 2026-07-01/)).toBeInTheDocument();
  });

  // ⚠️ A DEAD TAP IS WORSE THAN NO TAP. 4 zoned holds carry no photo; a painted panel that
  // swallows a tap in silence reads as broken. It must say so — and the description and date are
  // still the discriminator he came for.
  it('says so out loud when the hold has no photo', () => {
    const holds = [hold('a', 'ACTIVE', ['roof'], [], 'Hail dents')];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('roof'));
    const panel = within(screen.getByTestId('zone-evidence'));
    expect(panel.getByText('No photo on this one.')).toBeInTheDocument();
    expect(panel.getByText('Hail dents')).toBeInTheDocument();
    expect(panel.queryByRole('img')).toBeNull();
  });

  it('an unmarked panel stays inert rather than opening an empty drawer', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('driver-rear-door'));
    expect(screen.queryByTestId('zone-evidence')).toBeNull();
  });

  // ⭐ A REPAIRED hold is off the map, so its panel is unmarked — and must therefore be inert here
  // too. The two sides share `standingZonedHolds` precisely so they cannot disagree about this.
  it('a repaired hold is neither painted nor reachable', () => {
    const holds = [hold('a', 'REPAIRED', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('hood'));
    expect(screen.queryByTestId('zone-evidence')).toBeNull();
  });

  // ⭐ A RELEASED pre-existing hold is still ON the car — renting as-is, damage unrepaired — so its
  // photo has to be reachable. This is the exact case FG exists for.
  it('a RELEASED pre-existing hold still opens its photo', () => {
    const holds = [hold('a', 'RELEASED', ['front-bumper'], ['pre.jpg'], 'Pre-existing scuff')];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('front-bumper'));
    expect(within(screen.getByTestId('zone-evidence')).getByRole('img'))
      .toHaveAttribute('src', 'pre.jpg');
  });

  it('tapping the open panel again closes it', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('hood'));
    expect(screen.getByTestId('zone-evidence')).toBeInTheDocument();
    fireEvent.click(zone('hood'));
    expect(screen.queryByTestId('zone-evidence')).toBeNull();
  });

  it('tapping a second panel switches to it rather than stacking', () => {
    const holds = [
      hold('a', 'ACTIVE', ['hood'], ['hood.jpg'], 'Hood dent'),
      hold('b', 'ACTIVE', ['roof'], ['roof.jpg'], 'Roof dent'),
    ];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    fireEvent.click(zone('hood'));
    fireEvent.click(zone('roof'));
    const panel = within(screen.getByTestId('zone-evidence'));
    expect(panel.getByText('Roof dent')).toBeInTheDocument();
    expect(panel.queryByText('Hood dent')).toBeNull();
  });

  // ⭐ The diagram and the drawer must visibly refer to each other — without the ring, a tap on a
  // red panel produces text elsewhere on screen with nothing tying the two together.
  it('marks the panel being inspected on the diagram itself', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    expect(zone('hood')).not.toHaveAttribute('data-focused');
    fireEvent.click(zone('hood'));
    expect(zone('hood')).toHaveAttribute('data-focused', 'true');
  });

  // ⚠️ The default diagram label says "tap a panel to record damage there" — a lie in this mode,
  // and the sentence a screen reader actually announces.
  it('describes itself as a reader, not a recorder', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    render(<DamageZoneInspector holds={holds} zones={paint(holds)} />);
    expect(screen.getByTestId('damage-zone-map'))
      .toHaveAttribute('aria-label', expect.stringContaining('see the damage recorded'));
  });

  // ⚠️ The scan sheet's diagram was capped at 13rem while it was an untappable picture. It is a tap
  // target now, hit with nitrile gloves on — and shrinking a target he has to hit accurately is the
  // defect Aaron caught on 2026-08-25 ("may i ask why it was made smaller than the regular map").
  it('never width-caps the diagram, compact or not', () => {
    const holds = [hold('a', 'ACTIVE', ['hood'], ['p1.jpg'])];
    const { container } = render(
      <DamageZoneInspector holds={holds} zones={paint(holds)} compact />);
    expect(container.querySelector('[class*="max-w-[13rem]"]')).toBeNull();
  });
});
