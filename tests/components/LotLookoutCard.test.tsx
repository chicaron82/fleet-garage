// My Day's Lot Lookout card — a glance since Lot Lookout became its own module (2026-10-15). Since 2026-10-29 it glances
// at the bay log instead of the airport (*"strictly erin st"*). Erin St's count lives in the top bar's pill (2026-10-18).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, exit: BayLogRow['exit'], over: Partial<BayLogRow> = {}): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate: `LUR${id}`, unit_number: null, car: null, odometer: null, took_dirty: false, redo_of: null,
  shift_day: '2026-10-29', started_at: `2026-10-29T1${id}:00:00.000Z`, exit, exited_at: exit ? `2026-10-29T1${id}:30:00.000Z` : null, ...over,
});
let rows: BayLogRow[] = [];
vi.mock('../../src/hooks/useBayLog', () => ({ useBayLog: () => ({ rows, loaded: true, error: null }) }));
vi.mock('../../src/hooks/useLotCrew', () => ({
  useLotCrew: () => ({ crew: { summary: { vsa: { on: 2, out: 0 }, driver: { on: 3, out: 1 } }, members: [] } }),
}));
const { LotLookoutCard } = await import('../../src/components/my-day/LotLookoutCard');

beforeEach(() => { rows = []; });

describe('LotLookoutCard', () => {
  it('the header opens the Lot Lookout module', () => {
    const onOpen = vi.fn();
    render(<LotLookoutCard cardClass="" onOpen={onOpen} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Lot Lookout/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('⭐ the bay at a glance: what is in it, and how the day is going', () => {
    rows = [row(2, 'clean'), row(3, 'skip'), row(5, null)];
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText('In the bay: LUR5 since 10:00')).toBeTruthy();
    expect(screen.getByText('1 clean today · 1 still to do')).toBeTruthy();
  });

  it('an empty bay says so', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText("The bay's empty")).toBeTruthy();
    expect(screen.getByText('0 clean today')).toBeTruthy();
  });

  it('⭐ no airport, no Erin St strip, no links: a glance', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.queryByText(/Airport/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Plus one clean/ })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open' })).toBeNull();
  });

  it('shows the crew as numbers on the card', () => {
    render(<LotLookoutCard cardClass="" onOpen={() => {}} />);
    expect(screen.getByText('2 on')).toBeTruthy();
    expect(screen.getByText('3 on · 1 out')).toBeTruthy();
  });
});
