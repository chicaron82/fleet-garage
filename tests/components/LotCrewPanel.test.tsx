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
