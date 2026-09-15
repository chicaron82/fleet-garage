import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../../src/components/holds/StatusBadge';
import { holdBadgeConfig } from '../../src/lib/holdBadge';

// ⚠️⚠️ ONE WORD, ONE DEFINITION (2026-09-14). A sale car's badge on the Holds list comes from its
// VEHICLE status (SALE_CAR), not its hold type — so it had its own hand-typed 'Sale Car' that stayed
// bare when the hold-type badge became '🏷️ Sale Car'. The version Aaron sees 32 times on one list was
// the one that didn't change. This pins the two paths to the same label.
describe('StatusBadge — the sale-car badge agrees with the hold-type badge', () => {
  it('⭐ a SALE_CAR vehicle renders exactly the hold-type label', () => {
    render(<StatusBadge status="SALE_CAR" />);
    expect(screen.getByText(holdBadgeConfig(['sale_car']).label)).toBeTruthy();
  });

  it('⚠️ and it is not the bare word', () => {
    render(<StatusBadge status="SALE_CAR" />);
    expect(screen.queryByText('Sale Car')).toBeNull();
  });
});

// ⚠️⚠️ THE LIB TEST CANNOT COVER THIS PATH. `VEHICLE_CONFIG.SALE_CAR` is computed once at module load,
// so the disposition override lives in the COMPONENT, not in `holdBadgeConfig`. A green
// holdBadge.test.ts would report the feature correct while the badge on his screen still said
// "Sale Car" — which is exactly the shape of the 2026-09-14 miss this file was created for.
// Aaron, 2026-09-15: *"maybe show TB with the sale flag?"*
describe('StatusBadge — turnbacks and buy-backs are distinguishable', () => {
  it('⭐ a SALE_CAR vehicle with a turnback reads TB', () => {
    render(<StatusBadge status="SALE_CAR" disposition="turnback" />);
    expect(screen.getByText('🏷️ TB')).toBeTruthy();
    expect(screen.queryByText('🏷️ Sale Car')).toBeNull();
  });

  it('⭐ and a buy-back reads BB', () => {
    render(<StatusBadge status="SALE_CAR" disposition="buyback" />);
    expect(screen.getByText('🏷️ BB')).toBeTruthy();
  });

  // ⚠️ His explicit scope — *"Keep the sale unchanged. Only change TB/BB."*
  it('⚠️ a plain sale car is untouched, with or without an explicit disposition', () => {
    const { unmount } = render(<StatusBadge status="SALE_CAR" disposition="sale" />);
    expect(screen.getByText('🏷️ Sale Car')).toBeTruthy();
    unmount();
    render(<StatusBadge status="SALE_CAR" />);
    expect(screen.getByText('🏷️ Sale Car')).toBeTruthy();
  });

  // The teal lane is the SALE_CAR status colour and must survive the label swap — a TB is still a
  // sale car, and the colour carries the type while the word carries the kind.
  it('keeps the sale lane colour on a TB', () => {
    const { container } = render(<StatusBadge status="SALE_CAR" disposition="turnback" />);
    expect(container.querySelector('span')?.className).toContain('teal');
  });

  // ⚠️ A disposition must never reach a badge that is not a sale car.
  it('does not change a held vehicle that happens to carry a disposition', () => {
    render(<StatusBadge status="HELD" holdTypes={['damage']} disposition="turnback" />);
    expect(screen.getByText('💥 Damage')).toBeTruthy();
  });
});
