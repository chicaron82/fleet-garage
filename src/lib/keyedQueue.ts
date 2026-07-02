const tails = new Map<string, Promise<unknown>>();

/**
 * Per-key serialization queue for find-or-insert writes.
 *
 * The sibling primitive to `withSubmitLock` with the opposite semantic: the lock
 * DROPS a re-entrant call (right for a double-tapped submit — the second tap is
 * noise), while the queue makes it WAIT (right for concurrent enrichments — each
 * call may carry data the others don't, so none can be thrown away). Two
 * concurrent `createOrEnrichRegistry` calls for the same vehicle used to both
 * see "no row yet" and both insert; queued, the second runs after the first,
 * finds the freshly inserted row, and enriches it instead.
 *
 * Calls with the same key run strictly in submission order. Different keys run
 * in parallel. A rejection propagates to its own caller but never poisons the
 * chain — the next queued call still runs. The map entry is cleaned up when a
 * key's chain drains, so idle keys hold no memory.
 */
export function withKeyedQueue<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(key) ?? Promise.resolve();
  const run = prev.then(fn, fn); // run after prev settles, success or failure
  const tail = run.then(() => undefined, () => undefined); // settled-safe link
  tails.set(key, tail);
  void tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
