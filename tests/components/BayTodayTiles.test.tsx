// "Today so far" tiles on the read-only desktop (docs/ticket-lot-view-desktop-layout.md). Aaron, 2026-11-19: *"The left
// column feels bare with all that negative space"*. The fill is the list's own chips, grown: same counts, same filters.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BayTodayTiles } from '../../src/components/lot/BayTodayTiles';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, exit: BayLogRow['exit']): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate: `LUR${id}`, unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: '2026-11-19', started_at: `2026-11-19T15:0${id}:00.000Z`, exit, exited_at: `2026-11-19T15:2${id}:00.000Z`, note: null, hold_id: null,
});
const day = [row(1, 'clean'), row(2, 'clean'), row(3, 'erin'), row(4, 'clean')];

describe('BayTodayTiles', () => {
  it('⭐ the same counts the chips show, as tiles', () => {
    render(<BayTodayTiles rows={day} filter={null} onFilter={() => {}} />);
    const region = screen.getByRole('region', { name: 'Today so far' });
    expect(region.textContent).toContain('4through the bay');
    expect(region.textContent).toContain('3clean');
    expect(region.textContent).toContain('1for Erin St');
  });

  it('a tile filters the list, a second tap clears it, and the total is "show all"', () => {
    const onFilter = vi.fn();
    const { rerender } = render(<BayTodayTiles rows={day} filter={null} onFilter={onFilter} />);
    fireEvent.click(screen.getByRole('button', { name: /for Erin St/ }));
    expect(onFilter).toHaveBeenLastCalledWith('erin');
    rerender(<BayTodayTiles rows={day} filter="erin" onFilter={onFilter} />);
    expect(screen.getByRole('button', { name: /for Erin St/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /for Erin St/ }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
    fireEvent.click(screen.getByRole('button', { name: /through the bay/ }));
    expect(onFilter).toHaveBeenLastCalledWith(null);
  });

  it('clean is a count, not a filter (as on the chips); zero holds show no tile', () => {
    render(<BayTodayTiles rows={day} filter={null} onFilter={() => {}} />);
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['4through the bay', '1for Erin St']);
    expect(screen.queryByText(/held/)).toBeNull();
  });

  it('a filter tile says so on hover; the total and a tile already on say "show all"; Clean says nothing', () => {
    const { rerender } = render(<BayTodayTiles rows={day} filter={null} onFilter={() => {}} />);
    expect(screen.getByRole('button', { name: /for Erin St/ })).toHaveAttribute('title', 'Click to filter');
    expect(screen.getByRole('button', { name: /through the bay/ })).toHaveAttribute('title', 'Click to show all');
    expect(screen.getByText('clean').closest('[title]')).toBeNull();
    rerender(<BayTodayTiles rows={day} filter="erin" onFilter={() => {}} />);
    expect(screen.getByRole('button', { name: /for Erin St/ })).toHaveAttribute('title', 'Click to show all');
  });

  it('⚠️ counts only: no times, no pace (a per-hour view would show his breaks)', () => {
    const { container } = render(<BayTodayTiles rows={day} filter={null} onFilter={() => {}} />);
    expect(container.textContent).not.toMatch(/\d\d:\d\d|per hour|\/h/i);
  });

  it('an empty day shows nothing', () => {
    const { container } = render(<BayTodayTiles rows={[]} filter={null} onFilter={() => {}} />);
    expect(container.innerHTML).toBe('');
  });
});
