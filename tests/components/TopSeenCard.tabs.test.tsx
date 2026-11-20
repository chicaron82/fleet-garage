// Top 10 · most seen, two tabs (docs/ticket-top-seen-now-and-all-time.md). Aaron, 2026-11-19: *"is LJF672 really that
// popular that even after not being seen for 15 days its still #1?"* → "Now · 30 days" first, "All time" beside it.
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { MostSeen } from '../../src/lib/fleetHistory';
import type { Vehicle } from '../../src/types';

vi.mock('../../src/lib/haptics', () => ({ hapticLight: vi.fn() }));
vi.mock('../../src/components/shared/VehicleName', () => ({ VehicleName: ({ vehicle }: { vehicle: Vehicle }) => <>{vehicle.model}</> }));
const { TopSeenCard } = await import('../../src/components/analytics/TopSeenCard');

const car = (id: string, plate: string, model: string) => ({ id, licensePlate: plate, model, rentalClass: 'C' }) as unknown as Vehicle;
const byId = new Map([['t', car('t', 'LJF672', 'Model 3')], ['j', car('j', 'LUR278', 'Jetta')]]);
const row = (vehicleId: string, sightings: number) => ({ vehicleId, sightings, rank: 1, tiedWith: 1, prevRank: 1 });
const allTime: MostSeen = { rows: [row('t', 24)], moreTied: 0 };
const now: MostSeen = { rows: [row('j', 11)], moreTied: 0 };
const props = { vehiclesById: byId, since: '2026-08-16', onOpen: () => {} };

describe('TopSeenCard tabs', () => {
  it('⭐ opens on Now · 30 days: the car that keeps coming back, not the one coasting on an old lead', () => {
    render(<TopSeenCard ranking={allTime} rankingNow={now} {...props} />);
    expect(screen.getByRole('tab', { name: 'Now · 30 days' }).getAttribute('aria-selected')).toBe('true');
    expect(screen.getByText('LUR278')).toBeTruthy();
    expect(screen.queryByText('LJF672')).toBeNull();
    expect(screen.getByText(/Sightings in the last 30 days/)).toBeTruthy();
  });

  it('All time is the card as it was: every sighting since the start', () => {
    render(<TopSeenCard ranking={allTime} rankingNow={now} {...props} />);
    fireEvent.click(screen.getByRole('tab', { name: 'All time' }));
    expect(screen.getByText('LJF672')).toBeTruthy();
    expect(screen.queryByText('LUR278')).toBeNull();
    expect(screen.getByText(/Counting every sighting since 2026-08-16/)).toBeTruthy();
  });

  it('an empty month says so, rather than a blank card', () => {
    render(<TopSeenCard ranking={allTime} rankingNow={{ rows: [], moreTied: 0 }} {...props} />);
    expect(screen.getByText('No sightings in the last 30 days.')).toBeTruthy();
  });

  it('without a 30-day ranking there are no tabs, only the all-time card', () => {
    render(<TopSeenCard ranking={allTime} {...props} />);
    expect(screen.queryByRole('tablist')).toBeNull();
    expect(screen.getByText('LJF672')).toBeTruthy();
  });
});
