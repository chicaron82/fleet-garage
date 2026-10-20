// Aaron, 2026-10-20: "since 2026-08-16" read like a last-updated date. "i'd prefer it updated just now. so i know the
// changes were seen". The card now says when the NEWEST counted sighting landed.
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TopSeenCard } from '../../src/components/analytics/TopSeenCard';
import { newestSighting, type MostSeen } from '../../src/lib/fleetHistory';

const ranking: MostSeen = { rows: [{ vehicleId: 'v1', sightings: 18, rank: 1, tiedWith: 1, prevRank: 1 }], moreTied: 0 };
const iso = (minsAgo: number) => new Date(Date.now() - minsAgo * 60_000).toISOString();

describe('TopSeenCard — updated, not just since', () => {
  it('⭐ a sighting a moment ago reads "Updated just now"', () => {
    render(<TopSeenCard ranking={ranking} vehiclesById={new Map()} since="2026-08-16" latest={iso(0)} onOpen={vi.fn()} />);
    expect(screen.getByText('Updated just now')).toBeTruthy();
  });
  it('an older newest sighting says how old', () => {
    render(<TopSeenCard ranking={ranking} vehiclesById={new Map()} since="2026-08-16" latest={iso(135)} onOpen={vi.fn()} />);
    expect(screen.getByText('Updated 2h 15m ago')).toBeTruthy();
  });
  it('"since" now reads as where counting began, not a last-updated date', () => {
    render(<TopSeenCard ranking={ranking} vehiclesById={new Map()} since="2026-08-16" onOpen={vi.fn()} />);
    expect(screen.getByText(/Counting every sighting since 2026-08-16/)).toBeTruthy();
    expect(screen.queryByText(/^Updated/)).toBeNull();
  });
});

describe('newestSighting', () => {
  it('the latest of every car\'s last sighting; none → null', () => {
    expect(newestSighting(new Map([['a', '2026-10-19T10:00:00Z'], ['b', '2026-10-20T05:01:00Z'], ['c', '2026-10-18T22:00:00Z']]))).toBe('2026-10-20T05:01:00Z');
    expect(newestSighting(new Map())).toBeNull();
  });
});
