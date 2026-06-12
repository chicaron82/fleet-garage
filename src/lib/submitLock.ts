const inFlight = new Set<string>();

/**
 * Synchronous double-submit guard for insert-shaped writes.
 *
 * The `key` identifies the logical target (e.g. `hold:${vehicleId}`,
 * `release:${holdId}`). A re-entrant call with the same key *while the first is
 * still in flight* is dropped (resolves to `undefined`) — closing the same-frame
 * window that a React `submitting` state / `disabled` button can't, since those
 * only apply on the next render. Two rapid taps therefore produce exactly one
 * insert instead of two rows with two fresh UUIDs.
 *
 * The lock is module-level so it coordinates across every caller of a write
 * function by construction — no per-form discipline required. It always releases
 * in `finally`, including when the wrapped write throws (so the next legitimate
 * call proceeds). The real (first) call's return value and thrown errors both
 * propagate unchanged; only the dropped re-entrant call resolves `undefined`.
 */
export async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T | undefined> {
  if (inFlight.has(key)) return undefined;
  inFlight.add(key);
  try {
    return await fn();
  } finally {
    inFlight.delete(key);
  }
}
