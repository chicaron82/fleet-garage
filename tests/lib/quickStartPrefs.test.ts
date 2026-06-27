import { describe, it, expect, beforeEach, vi } from 'vitest';

// A controllable stand-in for the profile row + its read/write errors.
const server = {
  order: null as string[] | null,
  selectError: null as unknown,
  updateError: null as unknown,
  lastUpdate: undefined as string[] | null | undefined,
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: server.selectError ? null : { quick_start_order: server.order },
            error: server.selectError,
          }),
        }),
      }),
      update: (patch: { quick_start_order: string[] | null }) => ({
        eq: async () => {
          server.lastUpdate = patch.quick_start_order;
          if (!server.updateError) server.order = patch.quick_start_order;
          return { error: server.updateError };
        },
      }),
    }),
  },
}));

import { loadQuickStartOrder, fetchRemoteOrder, saveQuickStartOrder, clearQuickStartOrder } from '../../src/lib/quickStartPrefs';

const USER = 'user-1';

beforeEach(() => {
  localStorage.clear();
  server.order = null;
  server.selectError = null;
  server.updateError = null;
  server.lastUpdate = undefined;
});

describe('quickStartPrefs round-trip', () => {
  it('save writes the local cache and the profile', async () => {
    await saveQuickStartOrder(USER, ['b', 'a', 'c']);
    expect(loadQuickStartOrder(USER)).toEqual(['b', 'a', 'c']); // instant cache
    expect(server.lastUpdate).toEqual(['b', 'a', 'c']);          // durable profile
  });

  it('a fresh device (empty cache) picks up the order from the profile', async () => {
    // phone saved it; this device has nothing cached
    server.order = ['x', 'y', 'z'];
    expect(loadQuickStartOrder(USER)).toBeNull();
    const fetched = await fetchRemoteOrder(USER);
    expect(fetched).toEqual(['x', 'y', 'z']);
    expect(loadQuickStartOrder(USER)).toEqual(['x', 'y', 'z']); // cache now hydrated
  });

  it('a reset on another device propagates — null profile clears the stale cache', async () => {
    localStorage.setItem('fg_quickstart_' + USER, JSON.stringify(['old']));
    server.order = null; // reset elsewhere
    const fetched = await fetchRemoteOrder(USER);
    expect(fetched).toBeNull();
    expect(loadQuickStartOrder(USER)).toBeNull();
  });

  it('clear nulls the profile and the cache', async () => {
    await saveQuickStartOrder(USER, ['a']);
    await clearQuickStartOrder(USER);
    expect(loadQuickStartOrder(USER)).toBeNull();
    expect(server.lastUpdate).toBeNull();
  });

  it('keeps the order on-device even if the profile write fails (offline), and surfaces the error', async () => {
    server.updateError = { message: 'offline' };
    await expect(saveQuickStartOrder(USER, ['a', 'b'])).rejects.toBeTruthy();
    expect(loadQuickStartOrder(USER)).toEqual(['a', 'b']); // cache still holds it
  });

  it('a fetch error throws so the caller can keep the cached order', async () => {
    localStorage.setItem('fg_quickstart_' + USER, JSON.stringify(['keep']));
    server.selectError = { message: 'offline' };
    await expect(fetchRemoteOrder(USER)).rejects.toBeTruthy();
    expect(loadQuickStartOrder(USER)).toEqual(['keep']); // untouched
  });

  it('tolerates a corrupt cache entry', () => {
    localStorage.setItem('fg_quickstart_' + USER, '{not json');
    expect(loadQuickStartOrder(USER)).toBeNull();
  });
});
