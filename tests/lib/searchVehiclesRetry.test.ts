// docs/ticket-the-seven-seconds-are-a-retry-we-never-asked-for.md — one FG-owned retry, then the truth.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const answers: Array<{ data: unknown; error: unknown } | Error> = [];
const builder = {
  select: vi.fn(() => builder), or: vi.fn(() => builder), order: vi.fn(() => builder), limit: vi.fn(() => builder),
  retry: vi.fn(() => builder), abortSignal: vi.fn(() => builder),
  then: (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
    const next = answers.shift() ?? { data: [], error: null };
    return next instanceof Error ? reject(next) : resolve(next);
  },
};
const from = vi.fn(() => builder);
vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (...a: unknown[]) => from(...(a as [])) },
  writeWithRefresh: async (fn: () => PromiseLike<unknown>) => fn(),
}));

const { searchVehicles } = await import('../../src/lib/ev-detection');
const row = { license_plate: 'LUR307', unit_number: '5422787', make: 'Toyota', model: 'Corolla', year: 2026, color: 'White', is_hybrid: false, is_tesla: false, archived_at: null };
const dead = { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } };

beforeEach(() => { vi.useFakeTimers(); answers.length = 0; vi.clearAllMocks(); });
afterEach(() => { vi.useRealTimers(); });

describe('searchVehicles — one retry of our own', () => {
  it("turns the client's hidden 3-retry backoff OFF and sets a timeout", async () => {
    answers.push({ data: [row], error: null });
    await searchVehicles('LUR');
    expect(builder.retry).toHaveBeenCalledWith(false);
    expect(builder.abortSignal).toHaveBeenCalledTimes(1);
  });

  it('a single dropped request recovers silently on the retry', async () => {
    answers.push(dead, { data: [row], error: null });
    const p = searchVehicles('LUR');
    await vi.advanceTimersByTimeAsync(400);
    expect(await p).toMatchObject({ failed: false });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it('a dead network is reported after ONE retry — 400 ms, not 7 seconds', async () => {
    answers.push(dead, dead, dead, dead);
    let settled = false;
    const p = searchVehicles('LUR').then(r => { settled = true; return r; });
    await vi.advanceTimersByTimeAsync(399);
    expect(settled).toBe(false);                 // control: it really is waiting on the pause
    await vi.advanceTimersByTimeAsync(1);
    expect(await p).toEqual({ matches: [], failed: true });
    expect(from).toHaveBeenCalledTimes(2);       // not 4
  });

  it('a THROWN network failure gets the same single retry', async () => {
    answers.push(new TypeError('Failed to fetch'), { data: [row], error: null });
    const p = searchVehicles('LUR');
    await vi.advanceTimersByTimeAsync(400);
    expect((await p).failed).toBe(false);
  });

  it('a timeout or a server error is NOT retried', async () => {
    answers.push({ data: null, error: { name: 'TimeoutError', message: 'signal timed out' } });
    expect(await searchVehicles('LUR')).toEqual({ matches: [], failed: true });
    expect(from).toHaveBeenCalledTimes(1);
    answers.push({ data: null, error: { code: 'PGRST100', message: 'failed to parse filter' } });
    expect((await searchVehicles('LUR')).failed).toBe(true);
    expect(from).toHaveBeenCalledTimes(2);
  });
});
