import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HoldsVehicleRow } from '../../src/components/dashboard/HoldsVehicleRow';
import type { Vehicle, Hold } from '../../src/types';

// ⚠️⚠️ THE ALWAYS-RUNS HALF OF THE 412px CARD-WIDTH GUARD (2026-09-15).
//
// `tests/flows/layout.flow.ts` checks the real Holds list at phone width against REAL PIXELS — the
// only way to catch a layout bug honestly. But it can only do that on a day the lot happens to hold a
// car with a long write-up, and on a quiet day it now reports SKIP rather than failing (it used to go
// red and blocked four unrelated pushes, teaching only "bypass the gate").
//
// ⭐ A skipped test is one nobody looks at, so a quiet stretch would silently retire the rule. This
// file is the other half: its card is BUILT HERE, so it runs every single time.
//
// ⚠️ IT CANNOT ASSERT PIXELS. jsdom does no layout — every getBoundingClientRect is zeros — so a width
// check here would pass on a broken card and be worse than no test. It asserts the MECHANISM instead:
// the two classes that make the card able to shrink. Between the two files: this one proves the rule
// is still installed, the flow test proves it still works on the real thing.
const vehicle = {
  id: 'v1', unitNumber: '5422100', licensePlate: 'LUR327', make: 'Nissan', model: 'Kicks',
  year: 2026, color: 'Gray', status: 'HELD', branchId: 'YWG', isTesla: false,
  hasMobileCable: null, hasJ1772Adapter: null,
} as Vehicle;

// The live case from 2026-09-14, which is what made the bug visible.
const LONG = "Damage - written up as 'DMG', detail not done, rim and tire damage on the rear passenger side";
const hold = {
  id: 'h1', vehicleId: 'v1', status: 'ACTIVE', holdTypes: ['damage'],
  damageDescription: LONG, flaggedAt: '2026-09-14T18:00:00Z', flaggedBy: 'u1',
} as unknown as Hold;

const row = () => render(
  <HoldsVehicleRow vehicle={vehicle} latestHold={hold} streak={0}
    onOpen={() => {}} getName={() => 'Aaron S.'} />,
);

describe('HoldsVehicleRow — the card can still shrink at phone width', () => {
  // ⚠️ THE LOAD-BEARING ONE. A flex item's min-width defaults to its CONTENT, so without `min-w-0`
  // a long description cannot shrink to its `truncate` — the card grows past the screen instead,
  // losing its right border and pushing the type badge off the edge entirely.
  it('⭐⭐ keeps min-w-0 on the flex-1 card — without it the card grows instead of truncating', () => {
    const { container } = row();
    const card = container.querySelector('button');
    expect(card?.className).toContain('flex-1');
    expect(card?.className).toContain('min-w-0');
  });

  // The inner column needs it too, for the same reason one level down.
  it('keeps min-w-0 on the inner content column', () => {
    const { container } = row();
    const inner = [...container.querySelectorAll('div')].find(d => d.className.includes('overflow-hidden'));
    expect(inner?.className).toContain('min-w-0');
  });

  // ⚠️ The truncation is what min-w-0 EXISTS to permit. If the description stopped being cut, the
  // classes above would be guarding nothing.
  it('⚠️ still cuts a long description and marks it with an ellipsis', () => {
    row();
    const p = screen.getByText(/Damage - written up/);
    expect(p.textContent?.endsWith('…')).toBe(true);
    expect(p.textContent!.length).toBeLessThan(LONG.length);
    expect(p.className).toContain('truncate');
  });

  // ⚠️ And the badge the bug pushed off the screen must actually be rendered — the layout rule is
  // only worth having because something visible was being lost.
  it('renders the hold-type badge the overflow used to clip', () => {
    row();
    expect(screen.getByText('💥 Damage')).toBeTruthy();
  });
});
