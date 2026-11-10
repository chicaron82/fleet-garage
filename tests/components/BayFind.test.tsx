// 🔍 Find in the log (src/components/lot/BayFind.tsx, docs/ticket-bay-log-find-a-car.md): the query it sends, the
// read-only window, and a result opening its day in FG.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { BayLogRow } from '../../src/lib/lotBayLog';

const calls: { or?: string; gte?: [string, string]; limit?: number }[] = [];
let answer: BayLogRow[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => {
      const c: { or?: string; gte?: [string, string]; limit?: number } = {};
      calls.push(c);
      const q = {
        select: () => q,
        or: (f: string) => { c.or = f; return q; },
        gte: (k: string, v: string) => { c.gte = [k, v]; return q; },
        order: () => q,
        limit: (n: number) => { c.limit = n; return Promise.resolve({ data: answer, error: null }); },
      };
      return q;
    },
  },
}));
const { BayFind } = await import('../../src/components/lot/BayFind');
const { shiftDateStr } = await import('../../src/lib/shiftDay');

const yesterday = shiftDateStr(-1);
const mcn: BayLogRow = {
  id: 335, vehicle_id: 'v', plate: 'MCN117', unit_number: null, car: '2026 Volkswagen Taos · Green', odometer: null,
  started_at: `${yesterday}T20:43:27.000Z`, exit: 'clean', exited_at: `${yesterday}T20:46:32.000Z`, took_dirty: true,
  redo_of: null, shift_day: yesterday, note: null, hold_id: null,
};
beforeEach(() => { calls.length = 0; answer = []; });
const type = (v: string) => fireEvent.change(screen.getByRole('searchbox', { name: /Find a plate/ }), { target: { value: v } });

describe('🔍 Find in the log', () => {
  it('⭐ MCN117 asks for every spelling by contains, and the result opens its day', async () => {
    answer = [mcn];
    const onOpenDay = vi.fn();
    render(<BayFind onOpenDay={onOpenDay} />);
    type('mcn 117');
    const hit = await screen.findByRole('button', { name: 'MCN117, Yesterday: open that day' });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.or).toBe('plate.ilike.*MCN117*');
    expect(calls[0]!.gte).toBeUndefined();                 // FG: the whole log
    fireEvent.click(hit);
    expect(onOpenDay).toHaveBeenCalledWith(1);
  });

  it('O and 0 both ways, as the vehicle look-up does', async () => {
    render(<BayFind />);
    type('LZO503');
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(calls[0]!.or).toBe('plate.ilike.*LZO503*,plate.ilike.*LZ0503*,plate.ilike.*LZO5O3*');
  });

  it('⭐ the read-only link reaches back 14 shift-days and says so; its results open nothing', async () => {
    answer = [mcn];
    render(<BayFind readOnly />);
    expect(screen.getByPlaceholderText(/last 14 days/)).toBeInTheDocument();
    type('MCN117');
    expect(await screen.findByText('Yesterday')).toBeInTheDocument();
    expect(calls[0]!.gte).toEqual(['shift_day', shiftDateStr(-13)]);
    expect(screen.queryByRole('button', { name: /open that day/ })).toBeNull();
  });

  it('nothing found says so plainly, with the window on the read-only link', async () => {
    render(<BayFind readOnly />);
    type('ZZZ999');
    expect(await screen.findByText("ZZZ999 hasn't come through the bay in the last 14 days.")).toBeInTheDocument();
  });

  it('two characters ask nothing and say how many it needs', async () => {
    render(<BayFind />);
    type('MC');
    expect(screen.getByText('Type 3 or more of the plate.')).toBeInTheDocument();
    await new Promise(r => setTimeout(r, 350));
    expect(calls).toHaveLength(0);
  });
});
