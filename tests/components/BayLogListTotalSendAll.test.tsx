// The bay log's total, and ✈ Send all up (2026-11-10, docs/ticket-bay-total-and-send-all-up.md). Aaron: *"Have total
// amount of everything that came through the bay, instead of just the breakdown"* and *"A "send all" to mark whatever
// isn't already sent as sent. Not including vehicles held"*.
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BayLogList, type BayListEdit } from '../../src/components/lot/BayLogList';
import { baySummary, type BayLogRow } from '../../src/lib/lotBayLog';

let seq = 0;
const row = (exit: BayLogRow['exit'], over: Partial<BayLogRow> = {}): BayLogRow => {
  seq += 1;
  return {
    id: seq, vehicle_id: `v${seq}`, plate: `P${seq}`, unit_number: null, car: null, odometer: null, took_dirty: true,
    redo_of: null, shift_day: '2026-11-10', started_at: `2026-11-10T17:${String(seq).padStart(2, '0')}:00.000Z`, exit,
    exited_at: exit ? `2026-11-10T17:${String(seq).padStart(2, '0')}:30.000Z` : null, note: null, hold_id: null, ...over,
  };
};
const edit = (over: Partial<BayListEdit> = {}): BayListEdit => ({
  flagIds: new Set(), choicesFor: () => [], onNewHold: () => {}, onSameHold: async () => null, onNote: async () => null,
  onSentUp: async () => null, ...over,
});

describe('the total: every car out of the bay, once', () => {
  it('⭐ his screenshot\'s day: 14 + 7 + 3 + 1 = 25', () => {
    const rows = [
      ...Array.from({ length: 14 }, () => row('clean')), ...Array.from({ length: 7 }, () => row('erin')),
      ...Array.from({ length: 3 }, () => row('bhold')), row('mhold'),
    ];
    expect(baySummary(rows).total).toBe(25);
    render(<BayLogList heading="Today" rows={rows} />);
    expect(screen.getByRole('button', { name: '25 through the bay' })).toBeInTheDocument();
  });

  it('a bump is not an exit: skip then clean is one car; a bump still waiting is not in it; the car in the bay is not', () => {
    const bumped = row('skip');
    const rows = [bumped, row('clean', { redo_of: bumped.id }), row('skip'), row(null)];
    expect(baySummary(rows)).toMatchObject({ total: 1, stillToDo: 1 });
  });

  it('tapping it clears a chip filter: the list\'s show all', () => {
    const rows = [row('clean'), row('erin')];
    render(<BayLogList heading="Today" rows={rows} />);
    fireEvent.click(screen.getByRole('button', { name: '1 for Erin St' }));
    expect(screen.queryByText(rows[0]!.plate)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '2 through the bay' }));
    expect(screen.getByText(rows[0]!.plate)).toBeInTheDocument();
  });
});

describe('✈ Send all up', () => {
  it('⭐ names how many, counting only the unsent Cleans (Erin and holds are not Cleans)', () => {
    const onSendAll = vi.fn();
    render(<BayLogList heading="Today" rows={[row('clean'), row('clean', { sent_up: true }), row('clean'), row('erin'), row('bhold')]}
      edit={edit({ onSendAll })} />);
    fireEvent.click(screen.getByRole('button', { name: '✈ Send up the other 2' }));
    expect(onSendAll).toHaveBeenCalledTimes(1);
  });

  it('none sent yet reads "all N Cleans"', () => {
    render(<BayLogList heading="Today" rows={[row('clean'), row('clean')]} edit={edit({ onSendAll: () => {} })} />);
    expect(screen.getByRole('button', { name: '✈ Send up all 2 Cleans' })).toBeInTheDocument();
  });

  it('gone once every Clean is up, absent on an earlier day, never on the read-only link', () => {
    const { unmount } = render(<BayLogList heading="Today" rows={[row('clean', { sent_up: true })]} edit={edit({ onSendAll: () => {} })} />);
    expect(screen.queryByRole('button', { name: /Send up/ })).toBeNull();
    unmount();
    const r2 = render(<BayLogList heading="Mon" rows={[row('clean')]} edit={edit()} />);
    expect(screen.queryByRole('button', { name: /Send up/ })).toBeNull();
    r2.unmount();
    render(<BayLogList readOnly heading="Today" rows={[row('clean')]} />);
    expect(screen.queryByRole('button', { name: /Send up/ })).toBeNull();
  });
});
