import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  withTimeout, timeoutFor, makesSomethingNew, isGaveUp,
  ROW_TIMEOUT_MS, UPLOAD_TIMEOUT_MS, type GaveUp,
} from '../../src/lib/requestTimeout';

const REST = 'https://x.supabase.co/rest/v1';

/** A connection that accepts the request and never answers. It only ends if the signal aborts it,
 *  which is what a real fetch does. */
function hung() {
  const calls: { url: string; method: string }[] = [];
  const base = ((input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method ?? 'GET' });
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal;
      signal?.addEventListener('abort', () => reject(signal.reason));
    });
  }) as typeof fetch;
  return { base, calls };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe('timeoutFor — photos get longer than rows', () => {
  it('rows and auth share the short limit; storage gets the long one', () => {
    expect(timeoutFor(`${REST}/holds`)).toBe(ROW_TIMEOUT_MS);
    expect(timeoutFor('https://x.supabase.co/auth/v1/token?grant_type=refresh_token')).toBe(ROW_TIMEOUT_MS);
    expect(timeoutFor('https://x.supabase.co/storage/v1/object/damage-photos/a.jpg')).toBe(UPLOAD_TIMEOUT_MS);
    expect(UPLOAD_TIMEOUT_MS).toBeGreaterThan(ROW_TIMEOUT_MS * 5);
  });
});

describe('makesSomethingNew — which saves must not be blindly sent again', () => {
  it('a plain insert and an rpc do', () => {
    expect(makesSomethingNew(`${REST}/holds`, 'POST', { Prefer: 'return=representation' })).toBe(true);
    expect(makesSomethingNew(`${REST}/holds`, 'POST')).toBe(true);
    expect(makesSomethingNew(`${REST}/rpc/swap_shift_content`, 'POST')).toBe(true);
  });

  it('an upsert, an update, a delete and a read do not', () => {
    expect(makesSomethingNew(`${REST}/fleet_balance`, 'POST', { Prefer: 'resolution=merge-duplicates' })).toBe(false);
    expect(makesSomethingNew(`${REST}/fleet_balance`, 'POST', new Headers({ Prefer: 'resolution=ignore-duplicates,return=minimal' }))).toBe(false);
    expect(makesSomethingNew(`${REST}/holds?id=eq.1`, 'PATCH')).toBe(false);
    expect(makesSomethingNew(`${REST}/holds?id=eq.1`, 'DELETE')).toBe(false);
    expect(makesSomethingNew(`${REST}/holds`, 'GET')).toBe(false);
  });

  it('a photo upload or a sign-in is not a row being created', () => {
    expect(makesSomethingNew('https://x.supabase.co/storage/v1/object/damage-photos/a.jpg', 'POST')).toBe(false);
    expect(makesSomethingNew('https://x.supabase.co/auth/v1/token', 'POST')).toBe(false);
  });
});

describe('withTimeout — a request that never answers gives up', () => {
  it('rejects at the limit, as an AbortError, and reports what it gave up on', async () => {
    const { base } = hung();
    const gaveUp: GaveUp[] = [];
    const settled = withTimeout(base, info => gaveUp.push(info))(`${REST}/holds`, { method: 'POST' })
      .then(() => 'answered', e => e);

    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS - 1);
    expect(gaveUp).toHaveLength(0);                       // CONTROL: not a moment early

    await vi.advanceTimersByTimeAsync(1);
    const error = await settled;
    expect(error.name).toBe('AbortError');
    expect(isGaveUp(error)).toBe(true);
    expect(gaveUp).toEqual([{ url: `${REST}/holds`, method: 'POST', makesSomethingNew: true }]);
  });

  it('an answer stops the clock — nothing fires later', async () => {
    const gaveUp: GaveUp[] = [];
    const base = (async () => new Response('[]')) as typeof fetch;
    const res = await withTimeout(base, info => gaveUp.push(info))(`${REST}/holds`);
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS * 2);
    expect(res.ok).toBe(true);
    expect(gaveUp).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('a slow photo upload is NOT cut off at the row limit', async () => {
    const { base } = hung();
    const gaveUp: GaveUp[] = [];
    const settled = withTimeout(base, info => gaveUp.push(info))(
      'https://x.supabase.co/storage/v1/object/damage-photos/a.jpg', { method: 'POST' },
    ).then(() => 'answered', e => e);

    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS * 5);
    expect(gaveUp).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS);
    expect(isGaveUp(await settled)).toBe(true);
  });

  it("a caller's own tighter signal still wins, with its own reason", async () => {
    const { base } = hung();
    const gaveUp: GaveUp[] = [];
    const own = new AbortController();
    const settled = withTimeout(base, info => gaveUp.push(info))(`${REST}/vehicles`, { signal: own.signal })
      .then(() => 'answered', e => e);
    own.abort(new DOMException('signal timed out', 'TimeoutError'));
    const error = await settled;
    expect(error.name).toBe('TimeoutError');
    expect(isGaveUp(error)).toBe(false);
    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS * 2);
    expect(gaveUp).toHaveLength(0);                       // the shared limit did not also fire
  });

  it('isGaveUp is false for a dropped request and a server refusal', () => {
    expect(isGaveUp(new TypeError('Failed to fetch'))).toBe(false);
    expect(isGaveUp({ code: '23505', message: 'duplicate key value' })).toBe(false);
    expect(isGaveUp(null)).toBe(false);
  });
});

// ⭐ The claims above are about a wrapper. These are about the INSTALLED client using it, which is
// what he actually runs: that the option is honoured, that a timed-out read is not retried three
// more times, and that the error arrives in the shape every screen already checks.
describe('the real supabase-js client, on a connection that never answers', () => {
  function clientOn(base: typeof fetch, gaveUp: GaveUp[]) {
    return createClient('https://x.supabase.co', 'anon-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: withTimeout(base, info => gaveUp.push(info)) },
    });
  }

  it('a read gives up ONCE at the limit — postgrest does not retry it', async () => {
    const { base, calls } = hung();
    const gaveUp: GaveUp[] = [];
    const pending = clientOn(base, gaveUp).from('vehicles').select('id');
    const settled = Promise.resolve(pending);

    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS);
    const { data, error } = await settled;
    expect(data).toBeNull();
    expect(isGaveUp(error)).toBe(true);

    await vi.advanceTimersByTimeAsync(60_000);            // room for 1s/2s/4s retries, had there been any
    expect(calls).toHaveLength(1);
    expect(gaveUp[0].makesSomethingNew).toBe(false);
  });

  it('an insert that hangs is reported as "may have made something"; an upsert is not', async () => {
    const { base } = hung();
    const gaveUp: GaveUp[] = [];
    const client = clientOn(base, gaveUp);
    const insert = Promise.resolve(client.from('holds').insert({ note: 'x' }));
    const upsert = Promise.resolve(client.from('fleet_balance').upsert({ date: '2026-10-10' }, { onConflict: 'date' }));
    const update = Promise.resolve(client.from('holds').update({ note: 'y' }).eq('id', 1));

    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS);
    for (const r of [await insert, await upsert, await update]) expect(isGaveUp(r.error)).toBe(true);

    expect(gaveUp.filter(g => g.method === 'POST' && g.url.includes('/holds'))[0].makesSomethingNew).toBe(true);
    expect(gaveUp.filter(g => g.url.includes('/fleet_balance'))[0].makesSomethingNew).toBe(false);
    expect(gaveUp.filter(g => g.method === 'PATCH')[0].makesSomethingNew).toBe(false);
    expect(gaveUp).toHaveLength(3);
  });
  it('a photo upload through the real client outlives the row limit, and still ends', async () => {
    const { base, calls } = hung();
    const gaveUp: GaveUp[] = [];
    const upload = clientOn(base, gaveUp).storage.from('damage-photos')
      .upload('a.jpg', new Blob(['x']), { contentType: 'image/jpeg' });

    await vi.advanceTimersByTimeAsync(ROW_TIMEOUT_MS * 5);
    expect(calls.filter(c => c.url.includes('/storage/v1/'))).toHaveLength(1);   // CONTROL: it was really sent
    expect(gaveUp).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(UPLOAD_TIMEOUT_MS);
    const { data, error } = await upload;
    expect(data).toBeNull();
    expect(error).toBeTruthy();
    expect(gaveUp).toHaveLength(1);
    expect(gaveUp[0].makesSomethingNew).toBe(false);
  });
});
