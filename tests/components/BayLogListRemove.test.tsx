// His delete on the list (Aaron, 2026-11-06: *"We need a delete option for me"*; docs/ticket-bay-remove-a-row.md).
// Remove asks in the line; Keep closes; a refusal stays and says so; never on the read-only link or an earlier day.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BayLogList, type BayListEdit } from '../../src/components/lot/BayLogList';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const row = (id: number, plate: string, exit: BayLogRow['exit'], note: string | null = null): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate, unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: '2026-11-06', started_at: `2026-11-06T21:3${id}:00.000Z`, exit, exited_at: `2026-11-06T21:4${id}:00.000Z`, note, hold_id: null,
});
const edit = (over: Partial<BayListEdit> = {}): BayListEdit => ({
  flagIds: new Set(), choicesFor: () => [], onNewHold: () => {}, onSameHold: async () => null, onNote: async () => null, onSentUp: async () => null, ...over,
});

describe('Remove on today\'s bay list', () => {
  it('⭐ Remove asks in the line, names the car, and Remove takes it off', async () => {
    const onRemove = vi.fn(async () => null);
    render(<BayLogList heading="Today" rows={[row(2, 'LUR367', 'clean')]} edit={edit({ onRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(screen.getByText(/Remove LUR367 · Clean \d\d:42 from today's list\? The count goes back with it\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(onRemove).toHaveBeenCalledWith(2));
  });

  it('Keep closes it and nothing is sent; a refusal stays in the line', async () => {
    const onRemove = vi.fn(async () => 'LZM569 is still in the bay. Give it an exit first.');
    render(<BayLogList heading="Today" rows={[row(1, 'LUR322', 'clean', '3 different winter tires on')]} edit={edit({ onRemove })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep' }));
    expect(screen.queryByText(/from today's list/)).toBeNull();
    expect(onRemove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Remove' }).at(-1)!);
    expect(await screen.findByRole('alert')).toHaveTextContent('still in the bay');
  });

  it('no Remove without onRemove (an earlier day), and none on the read-only link', () => {
    const { unmount } = render(<BayLogList heading="Nov 5" rows={[row(1, 'LUR185', 'clean')]} edit={edit()} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.getByRole('button', { name: '+ Note' })).toBeInTheDocument();
    unmount();
    render(<BayLogList readOnly heading="Today" rows={[row(1, 'LUR185', 'clean')]} edit={edit({ onRemove: async () => null })} />);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });
});
