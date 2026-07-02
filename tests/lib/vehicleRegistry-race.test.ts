// The createOrEnrichRegistry race: two concurrent calls for the same vehicle
// used to both see "no row yet" and both insert (five fire-and-forget call
// sites, no DB unique constraint). The keyed queue serializes them so the
// second call finds the first's row and ENRICHES it — one row, no lost fields.
// A drop-lock would be wrong here: each call can carry enrichment the others
// don't (one records arrived_at, another cleaned_at). This locks the semantic.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Stateful fake supabase: an in-memory vehicle_registry with real async gaps
// so concurrent lookups genuinely interleave the way the live client does. ──

interface FakeRow { [k: string]: unknown }
const store: { registry: FakeRow[] } = { registry: [] };
const tick = () => new Promise<void>((r) => setTimeout(r, 0));

function makeChain(table: string) {
  const filters: Record<string, unknown> = {};
  let insertPayload: FakeRow | null = null;
  let updatePayload: FakeRow | null = null;
  const api = {
    select: () => api,
    or:     () => api,
    order:  () => api,
    limit:  () => api,
    in:     () => api,
    eq: (col: string, val: unknown) => { filters[col] = val; return api; },
    insert: (payload: FakeRow) => { insertPayload = payload; return api; },
    update: (payload: FakeRow) => { updatePayload = payload; return api; },
    maybeSingle: async () => {
      await tick(); // the async gap that lets a second lookup slip in
      if (table === 'vehicle_identifiers') return { data: null }; // no confirmed pairs
      const row = store.registry.find((r) =>
        Object.entries(filters).every(([k, v]) => r[k] === v));
      return { data: row ?? null };
    },
    single: async () => {
      if (insertPayload) {
        await tick(); // insert round-trip
        const row = { id: `r${store.registry.length + 1}`, created_at: 'now', ...insertPayload };
        store.registry.push(row);
        return { data: row, error: null };
      }
      if (updatePayload) {
        const row = store.registry.find((r) => r['id'] === filters['id']);
        if (row) Object.assign(row, updatePayload);
        return { data: row ?? null, error: null };
      }
      return { data: null, error: null };
    },
  };
  return api;
}

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (table: string) => makeChain(table) },
  writeWithRefresh: async (fn: () => unknown) => fn(),
}));

import { createOrEnrichRegistry } from '../../src/lib/vehicleRegistry';

beforeEach(() => {
  store.registry = [];
});

describe('createOrEnrichRegistry under concurrency', () => {
  it('two concurrent calls for the same plate produce ONE row with BOTH enrichments', async () => {
    const [a, b] = await Promise.all([
      createOrEnrichRegistry({ branchId: 'YWG', plate: 'ABC123', arrivedAt: '2026-07-01T08:00:00Z', date: '2026-07-01' }),
      createOrEnrichRegistry({ branchId: 'YWG', plate: 'ABC123', cleanedAt: '2026-07-01T09:30:00Z', date: '2026-07-01' }),
    ]);

    // One row — the race used to make two.
    expect(store.registry).toHaveLength(1);
    // No lost enrichment — the second call updated rather than being dropped.
    expect(store.registry[0]!['arrived_at']).toBe('2026-07-01T08:00:00Z');
    expect(store.registry[0]!['cleaned_at']).toBe('2026-07-01T09:30:00Z');
    // Both callers got the same logical entry back.
    expect(a?.id).toBe(b?.id);
  });

  it('different plates still run independently (two rows, no cross-blocking)', async () => {
    await Promise.all([
      createOrEnrichRegistry({ branchId: 'YWG', plate: 'AAA111', date: '2026-07-01' }),
      createOrEnrichRegistry({ branchId: 'YWG', plate: 'BBB222', date: '2026-07-01' }),
    ]);
    expect(store.registry).toHaveLength(2);
  });

  it('a sequential second call enriches the first row (find-or-insert unchanged)', async () => {
    await createOrEnrichRegistry({ branchId: 'YWG', plate: 'CCC333', arrivedAt: 'T1', date: '2026-07-01' });
    const second = await createOrEnrichRegistry({ branchId: 'YWG', plate: 'CCC333', dispatchedAt: 'T2', date: '2026-07-01' });
    expect(store.registry).toHaveLength(1);
    expect(second?.dispatchedAt).toBe('T2');
  });
});
