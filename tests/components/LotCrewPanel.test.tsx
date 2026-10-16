// His editable crew list on My Day. Aaron, 2026-10-15: *"2 buttons ALL, SELECTED. ALL selects all VSA to pull to move
// cars ... If someone is sick. Crossed off."*
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LotCrewPanel } from '../../src/components/my-day/LotCrewPanel';
import type { CrewMember } from '../../src/lib/lotCrew';

const m = (userId: string, name: string, role: CrewMember['role'], state: CrewMember['state'], onNow = true): CrewMember =>
  ({ userId, name, role, start: '06:45', end: '15:15', state, onNow, phase: onNow ? 'on' : 'later', marked: false });
const members = [
  m('a', 'Aaron S.', 'vsa', 'cleaning'), m('b', 'Moaz', 'vsa', 'cleaning'), m('k', 'Khaiat', 'vsa', 'cleaning', false),
  m('t', 'Tomek', 'vsa', 'out'), m('d', 'Larry C', 'driver', 'airport'),
];
const setup = () => {
  const mark = vi.fn(async () => null);
  render(<LotCrewPanel members={members} mark={mark} toast={vi.fn()} />);
  return mark;
};

describe('LotCrewPanel', () => {
  it('ALL pulls every VSA working right now to moving cars (not who is out, not who is not in yet)', async () => {
    const mark = setup();
    fireEvent.click(screen.getByRole('button', { name: 'All to moving cars' }));
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['a', 'b'], 'moving'));
  });

  it('⭐ SELECTED: check Moaz, send him — only Moaz moves', async () => {
    const mark = setup();
    fireEvent.click(screen.getByRole('checkbox', { name: /Moaz/ }));
    fireEvent.click(screen.getByRole('button', { name: /Send 1 checked/ }));
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['b'], 'moving'));
  });

  it('one tap on a person\'s state; tapping their current state again puts them back to the schedule', async () => {
    const mark = setup();
    fireEvent.click(screen.getByRole('group', { name: 'Larry C: To the airport' }).querySelector('button:nth-child(2)')!);
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['d'], 'other'));
    fireEvent.click(screen.getByRole('group', { name: 'Tomek: Out' }).querySelector('[aria-pressed="true"]')!);
    await waitFor(() => expect(mark).toHaveBeenCalledWith(['t'], 'clear'));
  });

  it('out is crossed off', () => {
    setup();
    expect(screen.getByText('Tomek').className).toContain('line-through');
  });
});

// Polish, 2026-10-15 21:03: *"i'm thinking of removing those who's shift window has passed. and removing Larry C from
// being displayed as a driver"*.
describe('LotCrewPanel — finished fold and leave off', () => {
  const done = (userId: string, name: string): CrewMember =>
    ({ userId, name, role: 'vsa', start: '06:45', end: '15:15', state: 'cleaning', onNow: false, phase: 'done', marked: false });

  it('⭐ finished shifts fold into "N finished", and open again to tap someone back on', () => {
    render(<LotCrewPanel members={[m('k', 'Khaiat', 'vsa', 'cleaning'), done('a', 'Aaron S.'), done('b', 'Moaz')]} mark={vi.fn(async () => null)} toast={vi.fn()} />);
    expect(screen.queryByText('Aaron S.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 finished ▾' }));
    expect(screen.getByText('Aaron S.')).toBeTruthy();
  });

  it('⭐ leave someone off, and bring someone back', async () => {
    const leaveOff = vi.fn(async () => null);
    render(<LotCrewPanel members={[m('d', 'Larry J', 'driver', 'airport')]} mark={vi.fn(async () => null)} toast={vi.fn()}
      leftOff={[{ userId: 'c', name: 'Larry C' }]} leaveOff={leaveOff} />);
    fireEvent.click(screen.getByRole('button', { name: /Leave someone off the crew line.*1 left off/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Leave off' }));
    await waitFor(() => expect(leaveOff).toHaveBeenCalledWith('d', true));
    fireEvent.click(screen.getByRole('button', { name: 'Bring back' }));
    await waitFor(() => expect(leaveOff).toHaveBeenCalledWith('c', false));
  });

  it('no switch passed: no leave-off control', () => {
    render(<LotCrewPanel members={[m('d', 'Larry J', 'driver', 'airport')]} mark={vi.fn(async () => null)} toast={vi.fn()} />);
    expect(screen.queryByText(/Leave someone off/)).toBeNull();
  });
});
