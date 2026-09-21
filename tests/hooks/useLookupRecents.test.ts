import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// ── Supabase: a chain that records what was asked and answers with ROWS ─────────
let ROWS: unknown[] = [];
const calls: { table: string; op: string; args: unknown[] }[] = [];
const upsert = vi.fn(async (..._a: unknown[]) => ({ error: null }));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const chain = {
        select: (...args: unknown[]) => { calls.push({ table, op: 'select', args }); return chain; },
        eq: (...args: unknown[]) => { calls.push({ table, op: 'eq', args }); return chain; },
        order: () => chain,
        limit: async () => ({ data: ROWS }),
        upsert: (...args: unknown[]) => { calls.push({ table, op: 'upsert', args }); return upsert(...args); },
      };
      return chain;
    },
  },
}));
vi.mock('../../src/lib/closingInventorySync', () => ({ currentUserId: vi.fn(async () => 'uid-aaron') }));

import { useLookupRecents } from '../../src/hooks/useLookupRecents';

const v = (plate: string) => ({
  license_plate: plate, unit_number: null, make: 'Volvo', model: 'XC40', year: 2026, color: 'Brown',
  is_hybrid: false, is_tesla: false, archived_at: null,
});

beforeEach(() => { ROWS = []; calls.length = 0; upsert.mockClear(); });

describe('useLookupRecents', () => {
  it('loads his recents in the typeahead shape, dropping a row whose car came back empty', async () => {
    ROWS = [{ looked_up_at: 't2', vehicles: v('MCN149') }, { looked_up_at: 't1', vehicles: null }];
    const { result } = renderHook(() => useLookupRecents(true));
    await waitFor(() => expect(result.current.recents).toHaveLength(1));
    expect(result.current.recents[0].license_plate).toBe('MCN149');
    expect(calls).toContainEqual({ table: 'lookup_recents', op: 'eq', args: ['user_id', 'uid-aaron'] });
  });

  it('records a look-up as an upsert on (user, car), then reloads', async () => {
    const { result } = renderHook(() => useLookupRecents(true));
    await act(async () => { await result.current.record('veh-1'); });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [row, opts] = upsert.mock.calls[0] as [Record<string, unknown>, Record<string, unknown>];
    expect(row).toMatchObject({ user_id: 'uid-aaron', vehicle_id: 'veh-1' });
    expect(opts).toEqual({ onConflict: 'user_id,vehicle_id' });
    // initial load + the reload the successful write triggered
    await waitFor(() => expect(calls.filter(c => c.op === 'select')).toHaveLength(2));
  });

  it('does nothing at all when disabled (every surface but Find a car)', async () => {
    const { result } = renderHook(() => useLookupRecents(false));
    await act(async () => { await result.current.record('veh-1'); });
    expect(result.current.recents).toEqual([]);
    expect(calls).toEqual([]);
    expect(upsert).not.toHaveBeenCalled();
  });
});
