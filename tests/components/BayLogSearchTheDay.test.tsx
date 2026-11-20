// Find narrows the open day (docs/ticket-bay-log-search-the-day.md). Aaron, 2026-11-20, 40 cars in: *"How bout this also
// searching within the day. I needed to mark something as Erin St but expanding it then having to look through the
// list is tedious"*.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import type { BayLogRow } from '../../src/lib/lotBayLog';
import type { BayListEdit } from '../../src/components/lot/BayLogList';

let answer: BayLogRow[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const q = {
        select: () => q, or: () => q, gte: () => q, order: () => q,
        limit: () => Promise.resolve({ data: answer, error: null }),
      };
      return q;
    },
  },
}));
const { BayLogList } = await import('../../src/components/lot/BayLogList');
const { BayFind } = await import('../../src/components/lot/BayFind');
const { shiftDateStr } = await import('../../src/lib/shiftDay');

const today = shiftDateStr(), yesterday = shiftDateStr(-1);
const row = (id: number, plate: string, exit: BayLogRow['exit'], day = today): BayLogRow => ({
  id, vehicle_id: `v${id}`, plate, unit_number: null, car: null, odometer: null, took_dirty: true, redo_of: null,
  shift_day: day, started_at: `${day}T21:${10 + id}:00.000Z`, exit, exited_at: `${day}T21:${20 + id}:00.000Z`, note: null, hold_id: null,
});
const edit = (over: Partial<BayListEdit> = {}): BayListEdit => ({
  flagIds: new Set(), choicesFor: () => [], onNewHold: () => {}, onSameHold: async () => null, onNote: async () => null,
  onSentUp: async () => null, ...over,
});
// Six finished cars: FG folds all but the last 3, so LUR525 (the first) sits behind "▾ 3 earlier" without a search.
const day = [row(1, 'LUR525', 'clean'), row(2, '0HL762', 'clean'), row(3, 'LUR224', 'clean'), row(4, 'LUR316', 'clean'),
  row(5, 'LZM569', 'clean'), row(6, 'LUR111', 'clean')];
const plates = () => screen.queryAllByRole('listitem').map(li => li.textContent ?? '');

describe('⭐ the day narrows to the plate', () => {
  it('a folded car comes up alone, and Change → Erin works on it', async () => {
    const onChangeExit = vi.fn(async () => null);
    const { rerender } = render(<BayLogList heading="The bay log" rows={day} edit={edit({ onChangeExit, onSendAll: () => {} })} />);
    expect(screen.queryByText('LUR525')).toBeNull();                  // behind the fold
    expect(screen.getByRole('button', { name: /Send up the other|Send up all/ })).toBeInTheDocument();
    rerender(<BayLogList heading="The bay log" rows={day} edit={edit({ onChangeExit, onSendAll: () => {} })} plate="525" />);
    expect(plates()).toHaveLength(1);
    expect(plates()[0]).toContain('LUR525');
    expect(screen.queryByRole('button', { name: /earlier/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /Send up/ })).toBeNull();  // it acts on the whole day
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    fireEvent.click(within(screen.getByRole('group', { name: 'Change the exit' })).getByRole('button', { name: 'Erin' }));
    await waitFor(() => expect(onChangeExit).toHaveBeenCalledWith(1, 'erin'));
  });

  it('O and 0 alike; nothing on the day says so', () => {
    const { rerender } = render(<BayLogList heading="The bay log" rows={day} edit={edit()} plate="OHL" />);
    expect(plates()).toHaveLength(1);
    expect(plates()[0]).toContain('0HL762');
    rerender(<BayLogList heading="The bay log" rows={day} edit={edit()} plate="ZZZ999" />);
    expect(screen.getByText("No ZZZ999 on this day's list.")).toBeInTheDocument();
  });

  it('no key, the list is as it was', () => {
    render(<BayLogList heading="The bay log" rows={day} edit={edit()} plate={null} />);
    expect(screen.getByRole('button', { name: '▾ 3 earlier' })).toBeInTheDocument();
  });
});

describe('⭐ Find hands the key up and leaves the open day out', () => {
  beforeEach(() => { answer = []; });
  const type = (v: string) => fireEvent.change(screen.getByRole('searchbox', { name: /Find a plate/ }), { target: { value: v } });

  it('the key goes up as typed, and back to null when cleared', () => {
    const onKey = vi.fn();
    render(<BayFind onKey={onKey} openBack={0} />);
    type('lur 525');
    expect(onKey).toHaveBeenLastCalledWith('LUR525');
    type('LU');
    expect(onKey).toHaveBeenLastCalledWith(null);
  });

  it("today's hit stays out of the results (it's in the list below); yesterday's opens its day", async () => {
    answer = [row(9, 'LUR525', 'clean'), row(8, 'LUR525', 'erin', yesterday)];
    const onOpenDay = vi.fn();
    render(<BayFind onOpenDay={onOpenDay} onKey={() => {}} openBack={0} />);
    type('525');
    fireEvent.click(await screen.findByRole('button', { name: 'LUR525, Yesterday: open that day' }));
    expect(onOpenDay).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: /Today: open that day/ })).toBeNull();
  });

  it("every hit on the open day: no \"hasn't come through\", since the list below has it", async () => {
    answer = [row(9, 'LUR525', 'clean')];
    render(<BayFind onKey={() => {}} openBack={0} />);
    type('525');
    await new Promise(r => setTimeout(r, 400));
    expect(screen.queryByText(/hasn't come through/)).toBeNull();
    expect(screen.queryByRole('list', { name: 'Found in the bay log' })).toBeNull();
  });
});
