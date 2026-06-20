import { describe, it, expect, vi } from 'vitest';
import { withSubmitLock } from '../../src/lib/submitLock';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe('withSubmitLock', () => {
  it('drops a re-entrant call with the same key while the first is in flight', async () => {
    const d = deferred<void>();
    const fn = vi.fn(() => d.promise);

    const first = withSubmitLock('same-frame', fn);        // acquires the lock; fn pending
    const second = await withSubmitLock('same-frame', fn); // same key, still in flight → dropped

    expect(second).toBeUndefined();
    expect(fn).toHaveBeenCalledTimes(1);

    d.resolve();
    await first;
  });

  it('the real (first) call still resolves to its own value', async () => {
    const d = deferred<string>();
    const fn = vi.fn(() => d.promise);

    const first = withSubmitLock('returns-value', fn);
    void withSubmitLock('returns-value', fn); // dropped

    d.resolve('the-value');
    await expect(first).resolves.toBe('the-value');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('allows different keys to run concurrently', async () => {
    const fnA = vi.fn(async () => 'a');
    const fnB = vi.fn(async () => 'b');

    const [a, b] = await Promise.all([
      withSubmitLock('key-a', fnA),
      withSubmitLock('key-b', fnB),
    ]);

    expect(a).toBe('a');
    expect(b).toBe('b');
    expect(fnA).toHaveBeenCalledTimes(1);
    expect(fnB).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after success so a later same-key call runs', async () => {
    const fn = vi.fn(async () => 'ok');

    await withSubmitLock('sequential', fn);
    const again = await withSubmitLock('sequential', fn);

    expect(again).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('trip-arrive: five rapid taps fire the write exactly once (the duplicate-OTH bug class)', async () => {
    // Simulates five taps on "Back at Washbay" while the first write is still in flight.
    // Only the first call should reach writeArrival; the other four should be dropped.
    const d = deferred<void>();
    const writeArrival = vi.fn(async () => { await d.promise; });
    const tripId = 'trip-uuid-abc123';

    const p1 = withSubmitLock(`trip-arrive:${tripId}`, writeArrival);
    const p2 = withSubmitLock(`trip-arrive:${tripId}`, writeArrival);
    const p3 = withSubmitLock(`trip-arrive:${tripId}`, writeArrival);
    const p4 = withSubmitLock(`trip-arrive:${tripId}`, writeArrival);
    const p5 = withSubmitLock(`trip-arrive:${tripId}`, writeArrival);

    d.resolve();
    await Promise.all([p1, p2, p3, p4, p5]);

    expect(writeArrival).toHaveBeenCalledTimes(1);
  });

  it('releases the lock after the wrapped fn throws, and propagates the error', async () => {
    const boom = vi.fn(async () => { throw new Error('boom'); });
    await expect(withSubmitLock('after-throw', boom)).rejects.toThrow('boom');

    // Lock released despite the throw → a subsequent same-key call runs.
    const ok = vi.fn(async () => 'recovered');
    await expect(withSubmitLock('after-throw', ok)).resolves.toBe('recovered');

    expect(boom).toHaveBeenCalledTimes(1);
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
