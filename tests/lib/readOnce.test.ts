// The fast path for reads someone is waiting on (docs/ticket-waited-on-reads-still-wait-seven-seconds.md, 2026-10-18).
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/lib/supabase', () => ({ supabase: {}, writeWithRefresh: (op: () => PromiseLike<unknown>) => op() }));
const { readOnce, throwIfAnyFailed, ReadFailedError } = await import('../../src/lib/networkBlip');

const DEAD = { data: null, error: { message: 'TypeError: Failed to fetch' } };
function builder(answers: unknown[]) {
  const retry = vi.fn();
  let i = 0;
  const b = { retry: (on: boolean) => { retry(on); return Promise.resolve(answers[Math.min(i++, answers.length - 1)]); } };
  return { build: () => b as never, retry, calls: () => i };
}

describe('readOnce', () => {
  it('⭐ turns the library\'s own retries off on every attempt', async () => {
    const b = builder([{ data: [1], error: null }]);
    await readOnce(b.build, 0);
    expect(b.retry).toHaveBeenCalledWith(false);
  });
  it('⭐ a dead network gets ONE retry, then says so, in well under a second', async () => {
    const b = builder([DEAD, DEAD]);
    const t = Date.now();
    const r = await readOnce(b.build);
    expect(r.error).toBeTruthy();
    expect(b.calls()).toBe(2);
    expect(Date.now() - t).toBeLessThan(1000);
  });
  it('a blip that recovers on the retry returns the data', async () => {
    const b = builder([DEAD, { data: ['car'], error: null }]);
    expect(await readOnce(b.build, 0)).toEqual({ data: ['car'], error: null });
  });
  it('a non-network error is not retried', async () => {
    const b = builder([{ data: null, error: { message: 'permission denied' } }]);
    await readOnce(b.build, 0);
    expect(b.calls()).toBe(1);
  });
  it('⚠️ a THROWN failure comes back as an error, never as a rejection the caller forgets', async () => {
    const r = await readOnce(() => ({ retry: () => Promise.reject(new TypeError('Failed to fetch')) }) as never, 0);
    expect(r).toMatchObject({ data: null });
    expect(r.error).toBeInstanceOf(TypeError);
  });
});

describe('throwIfAnyFailed', () => {
  it('one failed read and the whole answer is refused', () => {
    expect(() => throwIfAnyFailed([{ error: null }, { error: { message: 'x' } }], 'nope')).toThrow(ReadFailedError);
    expect(() => throwIfAnyFailed([{ error: null }, { error: null }], 'nope')).not.toThrow();
  });
});
