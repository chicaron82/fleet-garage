// useBayLog's two fixes from /reflect 88 (d2441b18), untested until /reflect 89 (2026-11-05):
//   • a car still in the bay from an earlier shift-day stays on the list (the read is today's rows OR any open row), or
//     migration 161's one-car index refuses every Start into a bay that looks empty;
//   • every write carries his initials, so a Clean's +1 lands on Erin St's count as his, not "Lot".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const orCalls: string[] = [];
const yesterdayCar = { id: 7, vehicle_id: 'v-1', plate: 'LZM514', started_at: '2026-11-05T03:50:00Z', exit: null, exited_at: null, shift_day: '2026-11-04' };
const chain = {
  select: () => chain,
  or: (f: string) => { orCalls.push(f); return chain; },
  order: async () => ({ data: [yesterdayCar], error: null }),
};
const channel = { on: () => channel, subscribe: () => channel };
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: () => chain, channel: () => channel, removeChannel: async () => {} },
}));
const posted: Record<string, unknown>[] = [];
vi.mock('../../src/hooks/useLotPin', () => ({
  postLotSignedIn: async (body: Record<string, unknown>) => { posted.push(body); return { ok: true, json: {} }; },
}));
const { useBayLog } = await import('../../src/hooks/useBayLog');

beforeEach(() => { orCalls.length = 0; posted.length = 0; });

describe('useBayLog', () => {
  it('⭐ reads today\'s rows OR any car still in the bay, so last night\'s car is on the list', async () => {
    const { result } = renderHook(() => useBayLog('AS'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(orCalls[0]).toMatch(/^shift_day\.eq\.\d{4}-\d{2}-\d{2},exit\.is\.null$/);
    expect(result.current.rows.map(r => r.plate)).toEqual(['LZM514']);
  });

  it('⭐ every write carries his initials', async () => {
    const { result } = renderHook(() => useBayLog('AS'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { await result.current.start('v-2'); });
    await act(async () => { await result.current.exit(7, 'clean'); });
    expect(posted.map(p => p.by)).toEqual(['AS', 'AS']);
  });

  // docs/ticket-bay-clean-sent-up-at-exit.md: the card's ✈ Clean · sent up goes out as a Clean that says `sent`.
  it('⭐ ✈ Clean · sent up posts a Clean with sent: true; a plain Clean carries no sent', async () => {
    const { result } = renderHook(() => useBayLog('AS'));
    await waitFor(() => expect(result.current.loaded).toBe(true));
    await act(async () => { await result.current.exit(7, 'sent'); });
    await act(async () => { await result.current.exit(7, 'clean'); });
    expect(posted[0]).toMatchObject({ action: 'bayExit', id: 7, exit: 'clean', sent: true });
    expect(posted[1]).not.toHaveProperty('sent');
  });
});
