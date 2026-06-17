import { describe, it, expect } from 'vitest';
import {
  deriveHoldStatus, toVehicleStatus, factsFromRow, factsFromHold, findLinkedOpenException,
  type HoldFacts,
} from '../../src/lib/vehicle-status';

const f = (over: Partial<HoldFacts> = {}): HoldFacts => ({
  isActive: false, isSaleCar: false, isOpenException: false, isOpenMechanical: false, isPreExisting: false, ...over,
});

// ── The cascade ─────────────────────────────────────────────────────────────

describe('deriveHoldStatus', () => {
  it('no facts → clear', () => {
    expect(deriveHoldStatus([])).toBe('clear');
  });

  it('all-resolved (repaired/returned) facts → clear', () => {
    expect(deriveHoldStatus([f(), f()])).toBe('clear');
  });

  it('ACTIVE non-sale-car → held', () => {
    expect(deriveHoldStatus([f({ isActive: true })])).toBe('held');
  });

  it('ACTIVE sale-car → sale-car', () => {
    expect(deriveHoldStatus([f({ isActive: true, isSaleCar: true })])).toBe('sale-car');
  });

  it('open-exception sale-car → auction-short-term', () => {
    expect(deriveHoldStatus([f({ isOpenException: true, isSaleCar: true })])).toBe('auction-short-term');
  });

  it('open-exception non-sale-car → on-exception', () => {
    expect(deriveHoldStatus([f({ isOpenException: true })])).toBe('on-exception');
  });

  it('open mechanical-release → on-exception (out, expected back)', () => {
    expect(deriveHoldStatus([f({ isOpenMechanical: true })])).toBe('on-exception');
  });

  it('mechanical-release does not trigger auction, even on a sale car', () => {
    expect(deriveHoldStatus([f({ isOpenMechanical: true, isSaleCar: true })])).toBe('on-exception');
  });

  it('pre-existing release → pre-existing', () => {
    expect(deriveHoldStatus([f({ isPreExisting: true })])).toBe('pre-existing');
  });

  // ── Precedence ──
  it('held beats sale-car', () => {
    expect(deriveHoldStatus([f({ isActive: true }), f({ isActive: true, isSaleCar: true })])).toBe('held');
  });

  it('active sale-car beats released sale-car (auction)', () => {
    expect(deriveHoldStatus([f({ isActive: true, isSaleCar: true }), f({ isOpenException: true, isSaleCar: true })])).toBe('sale-car');
  });

  it('auction beats pre-existing', () => {
    expect(deriveHoldStatus([f({ isOpenException: true, isSaleCar: true }), f({ isPreExisting: true })])).toBe('auction-short-term');
  });

  it('an open exception beats pre-existing (out on an override is the active concern)', () => {
    expect(deriveHoldStatus([f({ isPreExisting: true }), f({ isOpenException: true })])).toBe('on-exception');
  });

  it('a returned exception falls through to pre-existing (only open exceptions outrank)', () => {
    // isOpenException is false once it's back; the pre-existing clearance then wins.
    expect(deriveHoldStatus([f({ isPreExisting: true }), f({ isOpenException: false })])).toBe('pre-existing');
  });

  it('a grounding active hold wins over everything', () => {
    expect(deriveHoldStatus([
      f({ isActive: true }),
      f({ isOpenException: true, isSaleCar: true }),
      f({ isPreExisting: true }),
    ])).toBe('held');
  });
});

// ── Enum mapping ──────────────────────────────────────────────────────────────

describe('toVehicleStatus', () => {
  it.each([
    ['held', 'HELD'],
    ['sale-car', 'SALE_CAR'],
    ['auction-short-term', 'AUCTION_SHORT_TERM'],
    ['pre-existing', 'PRE_EXISTING'],
    ['on-exception', 'OUT_ON_EXCEPTION'],
    ['clear', 'CLEAR'],
  ] as const)('%s → %s', (input, expected) => {
    expect(toVehicleStatus(input)).toBe(expected);
  });
});

// ── Read-path adapter ─────────────────────────────────────────────────────────

describe('factsFromRow', () => {
  it('ACTIVE non-sale-car', () => {
    expect(factsFromRow({ status: 'ACTIVE', hold_types: ['mechanical'], releases: null }))
      .toEqual({ isActive: true, isSaleCar: false, isOpenException: false, isOpenMechanical: false, isPreExisting: false });
  });

  it('ACTIVE sale_car', () => {
    expect(factsFromRow({ status: 'ACTIVE', hold_types: ['sale_car'], releases: null }))
      .toMatchObject({ isActive: true, isSaleCar: true });
  });

  it('RELEASED open EXCEPTION', () => {
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['mechanical'], releases: [{ release_type: 'EXCEPTION', actual_return: null }] }))
      .toMatchObject({ isOpenException: true, isPreExisting: false });
  });

  it('RELEASED EXCEPTION that returned → not open', () => {
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['mechanical'], releases: [{ release_type: 'EXCEPTION', actual_return: '2026-05-22T18:00:00Z' }] }))
      .toMatchObject({ isOpenException: false });
  });

  it('RELEASED PRE_EXISTING', () => {
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['damage'], releases: [{ release_type: 'PRE_EXISTING', actual_return: null }] }))
      .toMatchObject({ isPreExisting: true, isOpenException: false });
  });

  it('RELEASED open MECHANICAL_RELEASE', () => {
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['mechanical'], releases: [{ release_type: 'MECHANICAL_RELEASE', actual_return: null }] }))
      .toMatchObject({ isOpenMechanical: true, isOpenException: false, isPreExisting: false });
  });

  it('RELEASED sale_car on open EXCEPTION', () => {
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['sale_car'], releases: [{ release_type: 'EXCEPTION', actual_return: null }] }))
      .toMatchObject({ isSaleCar: true, isOpenException: true });
  });

  it('null hold_types / null releases are safe', () => {
    expect(factsFromRow({ status: 'ACTIVE', hold_types: null, releases: null }))
      .toMatchObject({ isActive: true, isSaleCar: false, isOpenException: false, isPreExisting: false });
  });
});

// ── Write-path adapter ────────────────────────────────────────────────────────

describe('factsFromHold', () => {
  it('ACTIVE non-sale-car', () => {
    expect(factsFromHold({ status: 'ACTIVE', holdTypes: ['mechanical'] }))
      .toEqual({ isActive: true, isSaleCar: false, isOpenException: false, isOpenMechanical: false, isPreExisting: false });
  });

  it('ACTIVE sale_car', () => {
    expect(factsFromHold({ status: 'ACTIVE', holdTypes: ['sale_car'] }))
      .toMatchObject({ isActive: true, isSaleCar: true });
  });

  it('RELEASED open EXCEPTION', () => {
    expect(factsFromHold({ status: 'RELEASED', holdTypes: ['mechanical'], release: { releaseType: 'EXCEPTION' } }))
      .toMatchObject({ isOpenException: true });
  });

  it('RELEASED EXCEPTION that returned → not open', () => {
    expect(factsFromHold({ status: 'RELEASED', holdTypes: ['mechanical'], release: { releaseType: 'EXCEPTION', actualReturn: '2026-05-22T18:00:00Z' } }))
      .toMatchObject({ isOpenException: false });
  });

  it('RELEASED PRE_EXISTING', () => {
    expect(factsFromHold({ status: 'RELEASED', holdTypes: ['damage'], release: { releaseType: 'PRE_EXISTING' } }))
      .toMatchObject({ isPreExisting: true, isOpenException: false });
  });

  it('RELEASED open MECHANICAL_RELEASE', () => {
    expect(factsFromHold({ status: 'RELEASED', holdTypes: ['mechanical'], release: { releaseType: 'MECHANICAL_RELEASE' } }))
      .toMatchObject({ isOpenMechanical: true, isOpenException: false, isPreExisting: false });
  });

  it('RELEASED sale_car on EXCEPTION', () => {
    expect(factsFromHold({ status: 'RELEASED', holdTypes: ['sale_car'], release: { releaseType: 'EXCEPTION' } }))
      .toMatchObject({ isSaleCar: true, isOpenException: true });
  });
});

// ── Read/write parity ───────────────────────────────────────────────────────────
// The whole point of this module is that the read path (factsFromRow, over raw rows)
// and the write path (factsFromHold, over domain Holds) feed the SAME cascade and so
// can't drift. The adapters are tested separately above; this asserts they agree on
// the same logical hold — the contract that keeps the fleet view and stored status in sync.

describe('factsFromRow / factsFromHold parity', () => {
  it('produce identical facts for the same logical hold', () => {
    // Released sale-car on an open exception (the auction case).
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['sale_car'], releases: [{ release_type: 'EXCEPTION', actual_return: null }] }))
      .toEqual(factsFromHold({ status: 'RELEASED', holdTypes: ['sale_car'], release: { releaseType: 'EXCEPTION', actualReturn: null } }));

    // Active damage hold.
    expect(factsFromRow({ status: 'ACTIVE', hold_types: ['damage'], releases: null }))
      .toEqual(factsFromHold({ status: 'ACTIVE', holdTypes: ['damage'] }));

    // Returned exception (no longer open).
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['mechanical'], releases: [{ release_type: 'EXCEPTION', actual_return: '2026-05-01T00:00:00Z' }] }))
      .toEqual(factsFromHold({ status: 'RELEASED', holdTypes: ['mechanical'], release: { releaseType: 'EXCEPTION', actualReturn: '2026-05-01T00:00:00Z' } }));

    // Pre-existing release.
    expect(factsFromRow({ status: 'RELEASED', hold_types: ['damage'], releases: [{ release_type: 'PRE_EXISTING', actual_return: null }] }))
      .toEqual(factsFromHold({ status: 'RELEASED', holdTypes: ['damage'], release: { releaseType: 'PRE_EXISTING', actualReturn: null } }));
  });

  it('resolve to the same derived status end-to-end', () => {
    const row = factsFromRow({ status: 'RELEASED', hold_types: ['sale_car'], releases: [{ release_type: 'EXCEPTION', actual_return: null }] });
    const hold = factsFromHold({ status: 'RELEASED', holdTypes: ['sale_car'], release: { releaseType: 'EXCEPTION', actualReturn: null } });
    expect(deriveHoldStatus([row])).toBe(deriveHoldStatus([hold]));
    expect(deriveHoldStatus([row])).toBe('auction-short-term');
  });
});

// ── clearSaleHold's contract — a voided (RETURNED) sale_car hold reads as clear ──

describe('clearing a sale flag returns the vehicle to rentable', () => {
  it('a once-active sale_car hold, now RETURNED, is no longer sale-car', () => {
    const facts = factsFromHold({ status: 'RETURNED', holdTypes: ['sale_car'], release: null });
    expect(deriveHoldStatus([facts])).toBe('clear');
  });

  it('an auction-short-term hold cleared (RETURNED + release closed) is no longer auction', () => {
    // clearSaleHold sets the hold RETURNED and stamps actual_return on the release.
    const facts = factsFromHold({
      status: 'RETURNED', holdTypes: ['sale_car'],
      release: { releaseType: 'EXCEPTION', actualReturn: '2026-06-03T12:00:00Z' },
    });
    expect(facts.isOpenException).toBe(false);
    expect(deriveHoldStatus([facts])).toBe('clear');
  });

  it('does NOT clear a vehicle that still has a separate genuine active hold', () => {
    const clearedSale = factsFromHold({ status: 'RETURNED', holdTypes: ['sale_car'], release: null });
    const realDamage  = factsFromHold({ status: 'ACTIVE', holdTypes: ['damage'] });
    expect(deriveHoldStatus([clearedSale, realDamage])).toBe('held');
  });
});

// ── markRepaired's linked-exception close — the identity is the link, never text ──

interface TestHold {
  id: string;
  vehicleId: string;
  status: string;
  holdTypes: string[];
  linkedHoldId?: string | null;
  release?: { releaseType: string; actualReturn?: string | null } | null;
}

const exceptionRelease = (over: Partial<TestHold['release'] & object> = {}) => ({
  releaseType: 'EXCEPTION', actualReturn: null, ...over,
});

describe('findLinkedOpenException', () => {
  const openSibling: TestHold = {
    id: 'may5', vehicleId: 'rogue', status: 'RELEASED', holdTypes: ['mechanical'],
    release: exceptionRelease(),
  };

  it('returns the linked hold when it holds an open exception', () => {
    const repaired = { linkedHoldId: 'may5' };
    expect(findLinkedOpenException(repaired, [openSibling])).toBe(openSibling);
  });

  it('no linkedHoldId → null (unlinked holds are never matched)', () => {
    expect(findLinkedOpenException({ linkedHoldId: undefined }, [openSibling])).toBeNull();
    expect(findLinkedOpenException({ linkedHoldId: null }, [openSibling])).toBeNull();
  });

  it('linkedHoldId points at a hold not present → null', () => {
    expect(findLinkedOpenException({ linkedHoldId: 'ghost' }, [openSibling])).toBeNull();
  });

  it('linked exception already returned (actual_return set) → null', () => {
    const returned: TestHold = { ...openSibling, release: exceptionRelease({ actualReturn: '2026-06-02T12:00:00Z' }) };
    expect(findLinkedOpenException({ linkedHoldId: 'may5' }, [returned])).toBeNull();
  });

  it('linked release is PRE_EXISTING (not an exception) → null', () => {
    const preExisting: TestHold = { ...openSibling, release: { releaseType: 'PRE_EXISTING', actualReturn: null } };
    expect(findLinkedOpenException({ linkedHoldId: 'may5' }, [preExisting])).toBeNull();
  });

  it('linked release is a MECHANICAL_RELEASE (scoped to EXCEPTION) → null', () => {
    const mech: TestHold = { ...openSibling, release: { releaseType: 'MECHANICAL_RELEASE', actualReturn: null } };
    expect(findLinkedOpenException({ linkedHoldId: 'may5' }, [mech])).toBeNull();
  });

  it('linked hold is not RELEASED → null', () => {
    const active: TestHold = { ...openSibling, status: 'ACTIVE', release: null };
    expect(findLinkedOpenException({ linkedHoldId: 'may5' }, [active])).toBeNull();
  });
});

// The acceptance scenario, end-to-end through the same projection markRepaired runs:
// a May exception release + a linked June re-hold. Repairing the June hold must
// close the May exception so the vehicle derives off-exception — and must NOT when
// the holds aren't linked.
describe('repairing a linked re-hold resolves the stuck-on-exception vehicle', () => {
  const may5: TestHold = {
    id: 'may5', vehicleId: 'rogue', status: 'RELEASED', holdTypes: ['mechanical'],
    release: exceptionRelease(),
  };
  const repairedAt = '2026-06-02T15:00:00Z';

  // Mirror makeMarkRepaired's projection: repaired hold → REPAIRED, the linked
  // open exception → RETURNED with actual_return stamped.
  const project = (holds: TestHold[], repairedId: string, linked: TestHold | null) =>
    holds.map(h => {
      if (h.id === repairedId) return { ...h, status: 'REPAIRED' };
      if (linked && h.id === linked.id) return {
        ...h, status: 'RETURNED',
        release: h.release ? { ...h.release, actualReturn: repairedAt } : null,
      };
      return h;
    });

  it('stays on-exception before the fix (the stuck Rogue)', () => {
    const jun1: TestHold = { id: 'jun1', vehicleId: 'rogue', status: 'REPAIRED', holdTypes: ['mechanical'], linkedHoldId: 'may5' };
    // May5 still open, only Jun1 flipped to REPAIRED → the sibling keeps it stuck.
    expect(deriveHoldStatus([may5, jun1].map(factsFromHold))).toBe('on-exception');
  });

  it('linked repair closes the exception → clear', () => {
    const jun1: TestHold = { id: 'jun1', vehicleId: 'rogue', status: 'ACTIVE', holdTypes: ['mechanical'], linkedHoldId: 'may5' };
    const holds = [may5, jun1];
    const linked = findLinkedOpenException(jun1, holds);
    expect(linked).toBe(may5);
    const projected = project(holds, 'jun1', linked);
    expect(deriveHoldStatus(projected.map(factsFromHold))).toBe('clear');
  });

  it('an UNLINKED open exception is left untouched → still on-exception', () => {
    const jun1: TestHold = { id: 'jun1', vehicleId: 'rogue', status: 'ACTIVE', holdTypes: ['mechanical'] }; // no link
    const holds = [may5, jun1];
    const linked = findLinkedOpenException(jun1, holds);
    expect(linked).toBeNull();
    const projected = project(holds, 'jun1', linked);
    expect(deriveHoldStatus(projected.map(factsFromHold))).toBe('on-exception');
  });
});

// ── closeException's contract — a manually closed exception returns to derived status ──
// makeCloseException resolves a stale/orphaned open exception by stamping the
// release's actual_return and setting the hold RETURNED; the vehicle then derives
// off whatever holds remain (clear, unless another genuine hold grounds it).
describe('closing a stale exception returns the vehicle to its derived status', () => {
  it('a non-sale exception hold, closed (RETURNED + release closed), is no longer on-exception', () => {
    const closed = factsFromHold({
      status: 'RETURNED', holdTypes: ['mechanical'],
      release: { releaseType: 'EXCEPTION', actualReturn: '2026-06-10T20:00:00Z' },
    });
    expect(closed.isOpenException).toBe(false);
    expect(deriveHoldStatus([closed])).toBe('clear');
  });

  it('does NOT clear a vehicle that still has a separate active hold', () => {
    const closed = factsFromHold({
      status: 'RETURNED', holdTypes: ['mechanical'],
      release: { releaseType: 'EXCEPTION', actualReturn: '2026-06-10T20:00:00Z' },
    });
    const active = factsFromHold({ status: 'ACTIVE', holdTypes: ['damage'] });
    expect(deriveHoldStatus([closed, active])).toBe('held');
  });
});

// ── markRepairedBatch's contract — every selected hold REPAIRED, derived once ──
// The batch projects ALL selected holds as REPAIRED before deriving the vehicle a
// single time (looping single repairs would each derive off a stale snapshot and
// the last write would clobber the rest — the bug this op exists to avoid).
describe('batch-repairing a re-flag + its stale original clears the vehicle', () => {
  type H = { id: string; status: string; holdTypes: string[]; release?: { releaseType: string; actualReturn?: string | null } | null };
  const project = (holds: H[], ids: string[]) =>
    holds.map(h => ids.includes(h.id) ? { ...h, status: 'REPAIRED' } : h);
  const holds: H[] = [
    { id: 'active',   status: 'ACTIVE',   holdTypes: ['mechanical'] },
    { id: 'released', status: 'RELEASED', holdTypes: ['mechanical'], release: { releaseType: 'EXCEPTION', actualReturn: null } },
  ];

  it('before: the active grounds it held, the released keeps an open exception', () => {
    expect(deriveHoldStatus(holds.map(factsFromHold))).toBe('held');
  });

  it('both selected → both REPAIRED → clear', () => {
    expect(deriveHoldStatus(project(holds, ['active', 'released']).map(factsFromHold))).toBe('clear');
  });

  it('only the active one selected → the exception lingers → still on-exception (why both must be picked)', () => {
    expect(deriveHoldStatus(project(holds, ['active']).map(factsFromHold))).toBe('on-exception');
  });
});
