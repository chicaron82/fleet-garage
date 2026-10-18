// The parkade: a tap with no signal must stay on the phone with its own time, and send itself when signal is back.
// (Aaron, 2026-10-15: *"my cell connection at the parkade was atrocious"*. docs/ticket-lot-lookout-taps-wait-for-signal.md.)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAirportTaps } from '../../src/hooks/useAirportTaps';
import { EMPTY_READINGS } from '../../src/lib/lotAirport';
import type { LotPost } from '../../src/hooks/useLotPin';

const KEY = 'test_airport_queue';
const OFFLINE: LotPost = { ok: false, status: 0, error: 'No signal.', json: {} };
const OK: LotPost = { ok: true, status: 200, json: { ok: true, applied: true, airport: null } };
const airport = { readings: EMPTY_READINGS, loaded: true, error: null, nowMs: 0, setLocal: vi.fn() };

function setup(send: (b: Record<string, unknown>) => Promise<LotPost>) {
  const onFail = vi.fn();
  const toast = vi.fn();
  const hook = renderHook(() => useAirportTaps({ airport, send, by: 'AS', queueKey: KEY, onFail, toast }));
  return { hook, onFail, toast };
}

beforeEach(() => localStorage.removeItem(KEY));

describe('useAirportTaps — a tap never waits for signal', () => {
  it('⭐ with no signal the tap stays on screen, waits on the phone, and says so', async () => {
    const send = vi.fn(async () => OFFLINE);
    const { hook, toast } = setup(send);
    await act(async () => { await hook.result.current.tap('cleans', 0); });
    expect(hook.result.current.shown.cleans).toBe(0);
    expect(hook.result.current.waiting).toBe(1);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toHaveLength(1);
    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/No signal/));
  });

  it('⭐ signal comes back: the waiting tap sends with the time it was MADE, not the time it was sent', async () => {
    let online = false;
    const send = vi.fn(async (_b: Record<string, unknown>) => (online ? OK : OFFLINE));
    const { hook } = setup(send);
    await act(async () => { await hook.result.current.tap('returns', 0); });
    const madeAt = (send.mock.calls[0][0] as { at: string }).at;
    online = true;
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(hook.result.current.waiting).toBe(0));
    const last = send.mock.calls.at(-1)![0] as { at: string; field: string; value: number };
    expect(last).toMatchObject({ field: 'returns', value: 0, at: madeAt });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('two taps on one reading while offline send only the newer one', async () => {
    let online = false;
    const send = vi.fn(async (_b: Record<string, unknown>) => (online ? OK : OFFLINE));
    const { hook } = setup(send);
    await act(async () => { await hook.result.current.tap('cleans', 1); });
    await act(async () => { await hook.result.current.tap('cleans', 3); });
    expect(hook.result.current.waiting).toBe(1);
    online = true;
    send.mockClear();
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(hook.result.current.waiting).toBe(0));
    expect(send.mock.calls.map(c => (c[0] as { value: number }).value)).toEqual([3]);
  });

  it('⚠️ a wrong PIN (401) drops every waiting tap and says why, instead of retrying forever', async () => {
    let answer: LotPost = OFFLINE;
    const send = vi.fn(async () => answer);
    const { hook, onFail } = setup(send);
    await act(async () => { await hook.result.current.tap('cleans', 0); });
    await act(async () => { await hook.result.current.tap('aisle', 1); });
    answer = { ok: false, status: 401, error: 'That PIN is not right.', json: {} };
    await act(async () => { window.dispatchEvent(new Event('online')); });
    await waitFor(() => expect(hook.result.current.waiting).toBe(0));
    expect(onFail).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
  });

  it('a server error keeps the tap for the next try', async () => {
    const send = vi.fn(async () => ({ ok: false, status: 500, error: 'The board did not save.', json: {} }));
    const { hook } = setup(send);
    await act(async () => { await hook.result.current.tap('returns', 2); });
    expect(hook.result.current.waiting).toBe(1);
  });

  it('a tap left waiting when the page closed is still there when it opens again', () => {
    localStorage.setItem(KEY, JSON.stringify([{ field: 'aisle', value: 1, at: '2026-10-18T17:00:00.000Z' }]));
    const { hook } = setup(vi.fn(async () => OFFLINE));
    expect(hook.result.current.waiting).toBe(1);
    expect(hook.result.current.shown.aisle).toBe(true);
  });
});
