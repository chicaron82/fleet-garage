import { describe, it, expect } from 'vitest';
import {
  deriveHoldStatus, toVehicleStatus, factsFromRow, factsFromHold,
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

  it('pre-existing beats on-exception', () => {
    expect(deriveHoldStatus([f({ isPreExisting: true }), f({ isOpenException: true })])).toBe('pre-existing');
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
