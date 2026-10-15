// My Day's Lot Lookout card. Aaron, 2026-10-15: *"Is there a link to view my Erin St view within FG?"* There was
// one, as copy-only text inside the closed card. Now Erin St's count is on the card, always, one tap from the page
// where he taps it, and every link opens as well as copies.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { LotStall } from '../../src/lib/lotLookout';

const NOW = Date.parse('2026-10-15T16:30:00Z');
const stalls: LotStall[] = [{ stall: 'P3', run: 'P', num: 3, state: 'clean', tappedBy: 'AS', tappedAt: new Date(NOW).toISOString() }];

vi.mock('../../src/hooks/useLotBoard', () => ({
  useLotBoard: () => ({ stalls, aisle: { cars: 0, tappedBy: null, tappedAt: null }, loaded: true, error: null, nowMs: NOW }),
}));
let bay: unknown = {
  cleans: 6, cleansBy: 'AS', cleansAt: new Date(NOW - 3 * 60000).toISOString(),
  dirties: 23, dirtiesBy: 'AS', dirtiesAt: new Date(NOW - 12 * 60000).toISOString(), used: 2, usedOn: '2026-10-15',
};
vi.mock('../../src/hooks/useLotBay', () => ({ useLotBay: () => ({ bay, log: [], loaded: true, nowMs: NOW }) }));

const { LotLookoutCard } = await import('../../src/components/my-day/LotLookoutCard');

describe('LotLookoutCard', () => {
  it('shows Erin St\'s count without opening the card, one tap from the bay page', () => {
    render(<LotLookoutCard cardClass="" />);
    expect(screen.getByText('6')).toBeTruthy();
    expect(screen.getByText('23')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Tap the count/ }).getAttribute('href')).toBe('/lot/erin');
  });

  it('opened, every link can be opened as well as copied', () => {
    render(<LotLookoutCard cardClass="" />);
    fireEvent.click(screen.getByRole('button', { name: /See the lot/ }));
    const opens = screen.getAllByRole('link', { name: 'Open' }).map(a => a.getAttribute('href'));
    expect(opens).toEqual(['/lot', '/lot/erin', '/lot/view']);
    expect(screen.getAllByRole('button', { name: 'Copy' })).toHaveLength(3);
  });

  it('no Erin St row yet (or no table): the airport card still shows, with no strip', () => {
    bay = null;
    render(<LotLookoutCard cardClass="" />);
    expect(screen.queryByText('Erin St')).toBeNull();
    expect(screen.getByText(/Airport low on cleans/)).toBeTruthy();
  });
});
