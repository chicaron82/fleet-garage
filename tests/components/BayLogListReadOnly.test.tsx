// The read-only /lot/view shows his notes and the Erin line (Aaron, 2026-11-04: notes *"can be seen via the read-only
// link"*), and never a way to write: no + Note, no Flag it (docs/ticket-bay-erin-exit-notes-existing-hold.md).
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BayLogList } from '../../src/components/lot/BayLogList';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, exit: BayLogRow['exit'], note: string | null = null): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate: `LUR${id}`, unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: '2026-11-04', started_at: `2026-11-04T17:0${id}:00.000Z`, exit, exited_at: `2026-11-04T17:2${id}:00.000Z`, note, hold_id: null,
});

describe('BayLogList on the read-only link', () => {
  it('⭐ shows the note and the Erin line, and offers nothing to write', () => {
    render(<BayLogList readOnly heading="Today" rows={[row(1, 'erin', 'Row 6, pickup at 2'), row(2, 'bhold')]} />);
    expect(screen.getByText('📝 Row 6, pickup at 2')).toBeInTheDocument();
    expect(screen.getByText('Erin')).toBeInTheDocument();
    expect(screen.getByText('1 for Erin St')).toBeInTheDocument();
    // The chips filter here too, and they are the only buttons: no + Note, no Flag it.
    expect(screen.getAllByRole('button').map(b => b.textContent)).toEqual(['1 for Erin St', '1 held, damage']);
  });

  // *"Read-only gets the chips but not the fold. Display in reverse order most recent cleaned at the top"*.
  it('⭐ newest first, never folded, and a chip filters', () => {
    const rows = [1, 2, 3, 4, 5, 6].map(i => row(i, i === 3 ? 'erin' : 'clean'));
    render(<BayLogList readOnly heading="Today" rows={rows} />);
    const plates = () => screen.getAllByText(/^LUR\d$/).map(e => e.textContent);
    expect(plates()).toEqual(['LUR6', 'LUR5', 'LUR4', 'LUR3', 'LUR2', 'LUR1']);
    expect(screen.queryByText(/earlier/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '1 for Erin St' }));
    expect(plates()).toEqual(['LUR3']);
    expect(screen.getByRole('button', { name: '1 for Erin St' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: '1 for Erin St' }));
    expect(plates()).toHaveLength(6);
  });
});

describe('BayLogList in FG: the fold', () => {
  const edit = (flag: number[] = []) => ({ flagIds: new Set(flag), choicesFor: () => [], onNewHold: () => {},
    onSameHold: async () => null, onNote: async () => null });
  const plates = () => screen.getAllByText(/^LUR\d$/).map(e => e.textContent);

  it('⭐ the last 3 out, then "▾ N earlier", which opens the rest in place', () => {
    render(<BayLogList heading="Today" rows={[1, 2, 3, 4, 5, 6].map(i => row(i, 'clean'))} edit={edit()} />);
    expect(plates()).toEqual(['LUR6', 'LUR5', 'LUR4']);
    fireEvent.click(screen.getByRole('button', { name: '▾ 3 earlier' }));
    expect(plates()).toEqual(['LUR6', 'LUR5', 'LUR4', 'LUR3', 'LUR2', 'LUR1']);
    fireEvent.click(screen.getByRole('button', { name: '▴ Fold the list' }));
    expect(plates()).toEqual(['LUR6', 'LUR5', 'LUR4']);
  });

  it('⭐ an M / B row still waiting on Flag it stays out of the fold', () => {
    render(<BayLogList heading="Today" rows={[1, 2, 3, 4, 5, 6].map(i => row(i, i === 1 ? 'bhold' : 'clean'))} edit={edit([1])} />);
    expect(plates()).toEqual(['LUR6', 'LUR5', 'LUR4', 'LUR1']);
    expect(screen.getByRole('button', { name: 'Flag it →' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '▾ 2 earlier' })).toBeInTheDocument();
  });
});
