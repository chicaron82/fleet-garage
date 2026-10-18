// The parkade PIN: *"I couldn't log in with the pin while I was there earlier so couldn't tap anything ... logged in
// once I left"* (Aaron, 2026-10-15). No signal at the PIN screen now lets the driver in on trust; the first write that
// reaches the server checks it.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useLotPin } from '../../src/hooks/useLotPin';

beforeEach(() => { localStorage.clear(); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('useLotPin — a PIN with no signal', () => {
  it('⭐ no answer at all: the PIN is kept, marked unchecked, and the gate opens', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { result } = renderHook(() => useLotPin(vi.fn()));
    let problem: string | null = 'unset';
    await act(async () => { problem = await result.current.unlock('4821'); });
    expect(problem).toBeNull();
    expect(result.current.pin).toBe('4821');
    expect(result.current.pinUnchecked).toBe(true);
    act(() => result.current.pinWorked());
    expect(result.current.pinUnchecked).toBe(false);
  });

  it('⚠️ with signal, a wrong PIN is still refused at the gate', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'That PIN is not right.' }), { status: 401 })));
    const { result } = renderHook(() => useLotPin(vi.fn()));
    let problem: string | null = null;
    await act(async () => { problem = await result.current.unlock('0000'); });
    expect(problem).toBe('That PIN is not right.');
    expect(result.current.pin).toBe('');
  });

  it('a PIN taken on trust that a later write proves wrong is forgotten, so the page asks again', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch'); }));
    const { result } = renderHook(() => useLotPin(vi.fn()));
    await act(async () => { await result.current.unlock('0000'); });
    act(() => result.current.fail({ status: 401, error: 'That PIN is not right.' }));
    expect(result.current.pin).toBe('');
    expect(result.current.pinUnchecked).toBe(false);
  });
});
