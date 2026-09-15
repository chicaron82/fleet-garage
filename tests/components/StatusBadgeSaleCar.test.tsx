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
