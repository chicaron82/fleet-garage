// Today's crew, named, in Lot Lookout. ⭐ Since 2026-10-24 it is the schedule (*"Keeping track is too much"*): a
// names list, nothing to tap to keep it true. docs/ticket-crew-line-is-the-schedule.md.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LotCrewPanel } from '../../src/components/my-day/LotCrewPanel';
import type { CrewMember } from '../../src/lib/lotCrew';

const m = (userId: string, name: string, role: CrewMember['role'], over: Partial<CrewMember> = {}): CrewMember =>
  ({ userId, name, role, start: '06:45', end: '15:15', more: [], out: false, onNow: true, phase: 'on', ...over });

describe('LotCrewPanel', () => {
  it('⭐ lists who is scheduled, by role, with their times, and offers no job chips or pull buttons', () => {
    render(<LotCrewPanel members={[m('a', 'Aaron S.', 'vsa'), m('d', 'Rey', 'driver')]} toast={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'VSAs' })).toHaveTextContent('Aaron S.06:45–15:15');
    expect(screen.getByRole('region', { name: 'Drivers' })).toHaveTextContent('Rey');
    expect(screen.queryByRole('button', { name: /All to|Send|Cleaning|Moving cars|To the airport/ })).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('⭐ the [+] hours show with the shift (asked back the same day, 2026-10-26)', () => {
    render(<LotCrewPanel members={[m('a', 'Aaron S.', 'vsa', { more: [{ start: '17:00', end: '21:00' }] })]} toast={vi.fn()} />);
    expect(screen.getByRole('region', { name: 'VSAs' })).toHaveTextContent('Aaron S.06:45–15:15 +17:00–21:00');
  });

  it('out is crossed off and says out', () => {
    render(<LotCrewPanel members={[m('t', 'Tomek', 'vsa', { out: true, onNow: false })]} toast={vi.fn()} />);
    expect(screen.getByText('Tomek').className).toContain('line-through');
    expect(screen.getByText('out')).toBeTruthy();
  });
});

// Polish, 2026-10-15 21:03: *"i'm thinking of removing those who's shift window has passed. and removing Larry C from
// being displayed as a driver"*.
describe('LotCrewPanel — finished fold and leave off', () => {
  const done = (userId: string, name: string) => m(userId, name, 'vsa', { onNow: false, phase: 'done' });

  it('⭐ finished shifts fold into "N finished", and open again', () => {
    render(<LotCrewPanel members={[m('k', 'Khaiat', 'vsa'), done('a', 'Aaron S.'), done('b', 'Moaz')]} toast={vi.fn()} />);
    expect(screen.queryByText('Aaron S.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 finished ▾' }));
    expect(screen.getByText('Aaron S.')).toBeTruthy();
  });

  it('⭐ leave someone off, and bring someone back', async () => {
    const leaveOff = vi.fn(async () => null);
    render(<LotCrewPanel members={[m('d', 'Larry J', 'driver')]} toast={vi.fn()}
      leftOff={[{ userId: 'c', name: 'Larry C' }]} leaveOff={leaveOff} />);
    fireEvent.click(screen.getByRole('button', { name: /Leave someone off the crew line.*1 left off/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave off' }));
    await waitFor(() => expect(leaveOff).toHaveBeenCalledWith('d', true));
    fireEvent.click(screen.getByRole('button', { name: 'Bring back' }));
    await waitFor(() => expect(leaveOff).toHaveBeenCalledWith('c', false));
  });

  it('no switch passed: no leave-off control', () => {
    render(<LotCrewPanel members={[m('d', 'Larry J', 'driver')]} toast={vi.fn()} />);
    expect(screen.queryByText(/Leave someone off/)).toBeNull();
  });
});
