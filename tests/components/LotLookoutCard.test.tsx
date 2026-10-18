// My Day's Lot Lookout card — a glance since Lot Lookout became its own module (2026-10-15). The named crew list and
// the links live in the module, and the card's header opens it. The airport is two readings since 2026-10-18
// (migration 157), and Erin St's count lives in the top bar's pill since the same day (*"how bout removing it from
// "my day" and "lot loookout" modules"*).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const NOW = Date.parse('2026-10-15T16:30:00Z');
vi.mock('../../src/hooks/useLotAirport', () => ({
  useLotAirport: () => ({
    readings: { cleans: 0, cleansBy: 'LC', cleansAt: new Date(NOW - 14 * 60000).toISOString(), returns: 1, returnsBy: 'LC',
      returnsAt: new Date(NOW - 11 * 60000).toISOString(), aisle: true, aisleBy: 'LC', aisleAt: new Date(NOW - 11 * 60000).toISOString() },
    loaded: true, error: null, nowMs: NOW, setLocal: () => {},
  }),
}));
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({ crew: { summary: { vsa: { cleaning: 1, moving: 1, out: 0 }, driver: { airport: 1, other: 2, out: 0 } }, changedAt: null, members: [] }, mark: vi.fn() }),
}));
const { LotLookoutCard } = await import('../../src/components/my-day/LotLookoutCard');

describe('LotLookoutCard', () => {
  it('the header opens the Lot Lookout module', () => {
    const onOpen = vi.fn();
    render(<LotLookoutCard cardClass="" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Lot Lookout/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('⭐ no Erin St strip: the count lives in the top bar\'s pill now (2026-10-18)', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.queryByText('Erin St')).toBeNull();
    expect(screen.queryByRole('button', { name: /Plus one clean/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Dirties waiting/ })).toBeNull();
  });

  it('a glance: no notches, no named crew list, no links — those live in the module', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.queryByRole('button', { name: /Cleans on the lot/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Who is where/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
  });

  it('shows the crew as numbers on the card', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText('Cleaning 1 of 2 · 1 moving cars')).toBeTruthy();
    expect(screen.getByText('To the airport 1 of 3 · 2 on another job')).toBeTruthy();
  });

  it('⭐ the airport reads the way the bay needs it: room, returns, the aisle, each with its time', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText('Airport: Lots of room for cleans')).toBeTruthy();
    expect(screen.getByText('Lots of returns')).toBeTruthy();
    expect(screen.getByText('Cars in the aisle')).toBeTruthy();
    expect(screen.getAllByText(/· 1[14]m$/)).toHaveLength(3);
  });
});
