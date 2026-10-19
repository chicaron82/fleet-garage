// Reflection 87: a PIN taken on trust (no signal at the gate) is confirmed by ANY write that gets through, Erin's
// count included. Before, only an airport tap cleared it.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

vi.mock('../../src/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: null } }) } } }));
const { useBayTaps } = await import('../../src/hooks/useBayTaps');

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); });

describe('useBayTaps — Erin\'s count confirms a trusted PIN', () => {
  it('⭐ a write that gets through clears "unchecked"', async () => {
    localStorage.setItem('lot_pin', '4821');
    localStorage.setItem('lot_pin_unchecked', '1');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true, bay: { cleans: 3, dirties: 0, used: 0, used_on: null } }), { status: 200 })));
    const bay = { cleans: 2, cleansBy: null, cleansAt: null, dirties: 0, dirtiesBy: null, dirtiesAt: null, used: 0, usedOn: null };
    const state = { bay, log: [], loaded: true, nowMs: Date.now(), setBay: vi.fn() };
    const { result } = renderHook(() => useBayTaps(state as never, vi.fn()));
    await act(async () => { await result.current.tapCleans(1); });
    expect(localStorage.getItem('lot_pin_unchecked')).toBeNull();
  });
});
