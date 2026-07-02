// withKeyedQueue — the serialize-not-drop sibling of withSubmitLock. Same-key
// calls run strictly in order (each seeing the previous call's effects);
// different keys run in parallel; a rejection doesn't poison the chain.

import { describe, it, expect } from 'vitest';
import { withKeyedQueue } from '../../src/lib/keyedQueue';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

describe('withKeyedQueue', () => {
  it('serializes same-key calls in submission order', async () => {
    const order: string[] = [];
    const slow = withKeyedQueue('k', async () => {
      await tick(); await tick();
      order.push('first');
      return 1;
    });
    const fast = withKeyedQueue('k', async () => {
      order.push('second');
      return 2;
    });
    const [a, b] = await Promise.all([slow, fast]);
    expect(order).toEqual(['first', 'second']); // fast waited for slow
    expect(a).toBe(1);
    expect(b).toBe(2); // both ran — nothing dropped
  });

  it('runs different keys in parallel', async () => {
    const order: string[] = [];
    const a = withKeyedQueue('ka', async () => { await tick(); order.push('a'); });
    const b = withKeyedQueue('kb', async () => { order.push('b'); });
    await Promise.all([a, b]);
    expect(order).toEqual(['b', 'a']); // b did not wait behind a
  });

  it('a rejection propagates to its caller but does not poison the chain', async () => {
    const first = withKeyedQueue('k', async () => { throw new Error('boom'); });
    const second = withKeyedQueue('k', async () => 'still runs');
    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe('still runs');
  });

  it('a drained key starts fresh (no stale chain retained)', async () => {
    await withKeyedQueue('k2', async () => 'one');
    // Chain drained; a new call must still work normally.
    await expect(withKeyedQueue('k2', async () => 'two')).resolves.toBe('two');
  });
});
