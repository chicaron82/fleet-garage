// The three reads someone waits on used to throw their errors away: an empty fleet, a report of zeros, "no issues".
// (2026-10-18, docs/ticket-waited-on-reads-still-wait-seven-seconds.md.)
import { describe, it, expect, vi } from 'vitest';

const DEAD = { data: null, error: { message: 'TypeError: Failed to fetch' } };
const chain: Record<string, unknown> = {};
for (const m of ['from', 'select', 'eq', 'is', 'in', 'gte', 'lt', 'order', 'limit', 'maybeSingle']) chain[m] = () => chain;
chain.retry = () => Promise.resolve(DEAD);
vi.mock('../../src/lib/supabase', () => ({ supabase: chain, writeWithRefresh: (op: () => PromiseLike<unknown>) => op() }));

const { loadFleet, FleetLoadError } = await import('../../src/lib/fleet-master');
const { fetchShiftIssueLines } = await import('../../src/lib/fetchShiftIssueLines');
const { lookupRegistryAnyDate } = await import('../../src/lib/vehicleRegistry');

describe('waited-on reads on a dead network', () => {
  it('⭐ the fleet THROWS instead of coming back empty', async () => {
    await expect(loadFleet('YWG')).rejects.toBeInstanceOf(FleetLoadError);
  });
  it('⭐ the shift report\'s issues THROW instead of reading as "no issues today"', async () => {
    await expect(fetchShiftIssueLines('u1', '2026-10-18T09:00:00Z', '2026-10-19T09:00:00Z')).rejects.toThrow(/whole shift/);
  });
  it('the plate lookup stays a hint: null, fast, claiming nothing', async () => {
    const t = Date.now();
    expect(await lookupRegistryAnyDate('LZM441', 'YWG')).toBeNull();
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
