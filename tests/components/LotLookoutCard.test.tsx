// My Day's Lot Lookout card — a glance since Lot Lookout became its own module (2026-10-15). Erin St's count and its
// steppers stay on the card (*"May I suggest adding the cleans steppers here"*); the named crew list and the links
// moved to the module, and the card's header opens it. The airport is two readings since 2026-10-18 (migration 157).
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const NOW = Date.parse('2026-10-15T16:30:00Z');
vi.mock('../../src/hooks/useLotAirport', () => ({
  useLotAirport: () => ({
    readings: { cleans: 0, cleansBy: 'LC', cleansAt: new Date(NOW - 14 * 60000).toISOString(), returns: 1, returnsBy: 'LC',
      returnsAt: new Date(NOW - 11 * 60000).toISOString(), aisle: true, aisleBy: 'LC', aisleAt: new Date(NOW - 11 * 60000).toISOString() },
    loaded: true, error: null, nowMs: NOW, setLocal: () => {},
  }),
}));
let bay: unknown = {
  cleans: 6, cleansBy: 'AS', cleansAt: new Date(NOW - 3 * 60000).toISOString(),
  dirties: 23, dirtiesBy: 'AS', dirtiesAt: new Date(NOW - 12 * 60000).toISOString(), used: 2, usedOn: '2026-10-15',
};
vi.mock('../../src/hooks/useLotBay', () => ({ useLotBay: () => ({ bay, log: [], loaded: true, nowMs: NOW, setBay: () => {} }) }));
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({ crew: { summary: { vsa: { cleaning: 1, moving: 1, out: 0 }, driver: { airport: 1, other: 2, out: 0 } }, changedAt: null, members: [] }, mark: vi.fn() }),
}));
vi.mock('../../src/context/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Aaron Sauddin' } }) }));
const tapCleans = vi.fn();
const setDirties = vi.fn(async () => true);
let tapsBy = '';
vi.mock('../../src/hooks/useBayTaps', () => ({
  useBayTapsSignedIn: (_s: unknown, _t: unknown, by: string) => { tapsBy = by; return { tapCleans, setDirties }; },
}));

const { LotLookoutCard } = await import('../../src/components/my-day/LotLookoutCard');

describe('LotLookoutCard', () => {
  it('shows Erin St\'s count, and the header opens the Lot Lookout module', () => {
    const onOpen = vi.fn();
    render(<LotLookoutCard cardClass="" onOpen={onOpen} />);
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Dirties waiting: 23/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Open Lot Lookout/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('⭐ the steppers tap the count right on the card, signed in as him (no PIN)', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Plus one clean/ }));
    fireEvent.click(screen.getByRole('button', { name: /Minus one clean/ }));
    expect(tapCleans.mock.calls).toEqual([[1], [-1]]);
    expect(tapsBy).toBe('AS');
  });

  it('tap the dirties to type a new count; a bad one is refused before it is sent', async () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Dirties waiting: 23/ }));
    const box = screen.getByLabelText('New dirty count');
    fireEvent.change(box, { target: { value: '2300' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(setDirties).not.toHaveBeenCalled();
    fireEvent.change(box, { target: { value: '18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(setDirties).toHaveBeenCalledWith(18));
    await waitFor(() => expect(screen.queryByLabelText('New dirty count')).toBeNull());
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

  it('no Erin St row yet (or no table): the airport card still shows, with no strip', () => {
    bay = null;
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.queryByText('Erin St')).toBeNull();
    expect(screen.getByText('Airport: Lots of room for cleans')).toBeTruthy();
  });

  it('⭐ the airport reads the way the bay needs it: room, returns, the aisle, each with its time', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText('Lots of returns')).toBeTruthy();
    expect(screen.getByText('Cars in the aisle')).toBeTruthy();
    expect(screen.getAllByText(/· 1[14]m$/)).toHaveLength(3);
  });
});
