import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Hold } from '../../src/types';

// ⭐⭐ THE CASE THIS FILE EXISTS FOR: writing zones onto a hold created moments earlier.
//
// Both writes used to begin `holds.find(h => h.id === holdId)` and throw "Hold not found" when it
// missed. That is correct for a hold already on screen, and WRONG for a fresh one: `addHold`'s
// `setAllHolds` is asynchronous, so the array these closures captured at render time does not
// contain the hold yet. Collecting zones on the new-hold form (2026-08-24) would have thrown every
// single time — the local lookup was standing in for "does this hold exist?", and the proxy went
// false while the property stayed true. Existence is asked of the database now.

let rows: { id: string }[] = [{ id: 'h1' }];
let dbError: { message: string } | null = null;
const updates: Record<string, unknown>[] = [];

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (payload: Record<string, unknown>) => {
        updates.push(payload);
        return { eq: () => ({ select: async () => ({ data: rows, error: dbError }) }) };
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeEditHoldDamageZones, makeMarkZonesReviewed } from '../../src/context/holdEditing';

const setAllHolds = vi.fn();
const deps = { holds: [] as Hold[], allVehicles: [], setAllHolds, setAllVehicles: vi.fn() };
const editZones = makeEditHoldDamageZones(deps as never);
const markReviewed = makeMarkZonesReviewed(deps as never);

beforeEach(() => { rows = [{ id: 'h1' }]; dbError = null; updates.length = 0; setAllHolds.mockClear(); });

describe('zone writes on a hold the local array has never seen', () => {
  it('⭐ saves zones for a just-created hold (local array empty)', async () => {
    await expect(editZones('h1', ['roof', 'hood'])).resolves.toBeUndefined();
    expect(updates[0]).toEqual({ damage_zones: ['hood', 'roof'] });   // orderZones normalises
    expect(setAllHolds).toHaveBeenCalled();
  });

  it('⭐ marks "no panel applies" for a just-created hold', async () => {
    await expect(markReviewed('h1')).resolves.toBeUndefined();
    expect(updates[0].zones_reviewed_at).toEqual(expect.any(String));
  });

  it('clearing the review stamp writes null, not a timestamp', async () => {
    await markReviewed('h1', false);
    expect(updates[0]).toEqual({ zones_reviewed_at: null });
  });

  it('still refuses a hold that genuinely does not exist — the DB says so', async () => {
    rows = [];
    await expect(editZones('nope', ['roof'])).rejects.toThrow(/Hold not found/);
    await expect(markReviewed('nope')).rejects.toThrow(/Hold not found/);
  });

  it('surfaces a real write error rather than reporting success', async () => {
    dbError = { message: 'network' };
    await expect(editZones('h1', ['roof'])).rejects.toThrow(/Failed to save damage zones/);
    expect(setAllHolds).not.toHaveBeenCalled();
  });
});
