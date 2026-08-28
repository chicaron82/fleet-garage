import { describe, it, expect, beforeEach, vi } from 'vitest';

// The insert every assertion here is really about.
const inserted: Record<string, unknown>[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({ insert: async (row: Record<string, unknown>) => { inserted.push(row); return { error: null }; } }),
  },
  writeWithRefresh: async (fn: () => unknown) => fn(),
}));

const { holdSighting, dropPendingSighting, commitSightingFor, commitPendingSighting } =
  await import('../../src/hooks/useVehicleSightings');

const settle = () => new Promise(r => setTimeout(r, 0));
const typed = (vehicleId: string | null) => ({ plate: 'LUR224', vehicleId, seenById: 'u1', seenByName: 'Aaron', branchId: 'b1' });

beforeEach(() => { inserted.length = 0; dropPendingSighting(); });

// Aaron's rule stands: "typing something in just to look it up won't count as seen." What broke on
// 2026-08-28 is that the held sighting lived in a component ref and died on navigation — so
// "View unit" → update the odometer ON THE RECORD recorded nothing, twice in one day.

describe('a typed lookup is held, not recorded', () => {
  it('records nothing on its own — looking is not seeing', async () => {
    holdSighting(typed('v1'));
    await settle();
    expect(inserted).toHaveLength(0);
  });

  it('⭐ SURVIVES the navigation — the odometer write on the next screen redeems it', async () => {
    holdSighting(typed('v1'));
    commitSightingFor('v1');           // ← what recordOdometer / addHold now call
    await settle();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ plate: 'LUR224', vehicle_id: 'v1', seen_by_name: 'Aaron' });
  });

  it('is consumed at most once — two writes on the same car are still one visit', async () => {
    holdSighting(typed('v1'));
    commitSightingFor('v1');
    commitSightingFor('v1');           // he logs the odo AND flags it
    await settle();
    expect(inserted).toHaveLength(1);
  });

  // ⚠️ THE DOUBLE-COUNT GUARD. A photographed tag records its sighting at the read, so nothing is
  // held; the odometer he types straight afterwards must not add a second row.
  it('is a no-op when nothing is held — a scanned car cannot be double-counted', async () => {
    commitSightingFor('v1');
    await settle();
    expect(inserted).toHaveLength(0);
  });

  it('will not let an action on a DIFFERENT car redeem it', async () => {
    holdSighting(typed('v1'));
    commitSightingFor('v2');
    await settle();
    expect(inserted).toHaveLength(0);
  });

  it('drops unredeemed when he looks and walks away', async () => {
    holdSighting(typed('v1'));
    dropPendingSighting();
    commitSightingFor('v1');
    await settle();
    expect(inserted).toHaveLength(0);
  });

  // The scan router already knows he acted on the car he looked up, so it needs no id — and an
  // unknown plate (not yet in FG) has no vehicleId to match on.
  it('commits unscoped for the router, including a car FG does not have', async () => {
    holdSighting(typed(null));
    commitPendingSighting();
    await settle();
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ plate: 'LUR224', vehicle_id: null });
  });
});
