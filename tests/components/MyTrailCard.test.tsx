import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyTrailCard } from '../../src/components/my-day/MyTrailCard';

// ⭐⭐ COLLAPSED BY DEFAULT — Aaron, 2026-09-07: *"this block is useful but it takes up space
// especially if I have a busy day."* On an 86-car day the list buried everything below it.
//
// ⚠️ The card had NO component test until this change. It is the one surface in FG that speaks
// about HIM, and its whole value is being readable on a busy shift — so the collapse behaviour is
// exactly the part worth pinning.
const rows = [
  { vehicleId: 'v1', changedAt: '2026-09-08T14:00:00Z', actor: 'u1', changed: { key_count: { to: 2, from: null } } },
  { vehicleId: 'v2', changedAt: '2026-09-08T14:05:00Z', actor: 'u1', changed: { odometer: { to: 10, from: null } } },
];

vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({
    allVehicles: [
      { id: 'v1', licensePlate: 'LUR100', unitNumber: '5550001' },
      { id: 'v2', licensePlate: 'LUR200', unitNumber: '5550002' },
    ],
  }),
}));
const trail = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock('../../src/hooks/useMyTrail', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  useMyTrail: () => trail.rows,
}));

describe('MyTrailCard — collapsed by default', () => {
  beforeEach(() => { trail.rows = rows; });

  it('⭐ shows the count and NOT the list on first render', () => {
    render(<MyTrailCard />);
    expect(screen.getByText(/You've been at 2 cars today/)).toBeTruthy();
    expect(screen.queryByText(/LUR100/)).toBeNull();
  });

  it('⭐ the affordance says how many are hidden — a collapsed card must not read as the whole thing', () => {
    render(<MyTrailCard />);
    expect(screen.getByText(/Show 2/)).toBeTruthy();
  });

  it('expands on tap, and collapses again', () => {
    render(<MyTrailCard />);
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    expect(screen.getByText(/LUR100/)).toBeTruthy();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    fireEvent.click(toggle);
    expect(screen.queryByText(/LUR100/)).toBeNull();
  });

  // ⚠️ The established FG pattern, and the reason it matters: the card FILLS UP as his shift goes on
  // rather than greeting him with a zero at 06:45.
  it('⚠️ stays silent with no stops — no empty shell, no zero', () => {
    trail.rows = [];
    const { container } = render(<MyTrailCard />);
    expect(container.textContent).toBe('');
  });
});
