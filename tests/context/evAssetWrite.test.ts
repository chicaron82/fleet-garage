import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐⭐ THE POINT OF THIS FILE. `updateVehicleEVAssets` used to return void and swallow a failed
// Supabase write (`if (error) return;`). Nothing threw, so RegisterVehicleForm's try/catch around
// it was dead code and its "⚠️ the EV asset check didn't save" warning could never fire — a lost
// assessment reported as a clean registration. Found by Reflection 62 (2026-08-24), one night after
// R61 found the same shape elsewhere: a success message claiming a write that never happened.
//
// So the contract under test is not "does it write" — it is "does it TELL THE TRUTH about writing".

let updateError: { message: string } | null = null;
let insertError: { message: string } | null = null;
const inserted: Record<string, unknown>[] = [];

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      update: () => ({ eq: async () => ({ error: updateError }) }),
      insert: (row: Record<string, unknown>) => {
        if (table === 'ev_asset_updates') inserted.push(row);
        return Promise.resolve({ error: insertError });
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeUpdateVehicleEVAssets } from '../../src/context/evAssetWrite';

const setAll = vi.fn();
const write = makeUpdateVehicleEVAssets({ userId: 'u1', setAllVehicles: setAll });

beforeEach(() => { updateError = null; insertError = null; inserted.length = 0; setAll.mockClear(); });

describe('updateVehicleEVAssets — reports whether the status actually landed', () => {
  it('resolves true and logs the timeline row when the write succeeds', async () => {
    const ok = await write('v1', true, false, 'vsa_washbay');
    expect(ok).toBe(true);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      vehicle_id: 'v1', source: 'vsa_washbay',
      cable_status: 'present', adapter_status: 'missing', updated_by: 'u1',
    });
    expect(setAll).toHaveBeenCalled();
  });

  it('⭐ resolves FALSE when the canonical write fails — the caller must be able to warn', async () => {
    updateError = { message: 'network' };
    const ok = await write('v1', true, true, 'vsa_washbay');
    expect(ok).toBe(false);
    // and it must not pretend on the timeline or in local state
    expect(inserted).toHaveLength(0);
    expect(setAll).not.toHaveBeenCalled();
  });

  it('carries the source through — a check at the car is not a check at the counter', async () => {
    await write('v1', false, true, 'check_in');
    expect(inserted[0].source).toBe('check_in');
  });

  it('a failed TIMELINE row does not undo a status that did land', async () => {
    // Deliberate existing design: the profile update is canonical, the log is best-effort. The
    // caller is told the status saved, because it did.
    insertError = { message: 'timeline down' };
    expect(await write('v1', true, true, 'vsa_washbay')).toBe(true);
    expect(setAll).toHaveBeenCalled();
  });
});
