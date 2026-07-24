import { describe, it, expect } from 'vitest';
import { holdGroup, isClosedHold, groupHolds, isClearableSaleFlag } from '../../src/lib/holdGrouping';
import type { GroupableHold } from '../../src/lib/holdGrouping';

// The live case this was built from (unit 5423777, 2026-07-23): a geotab hold went out on
// exception, came back at the airport (→ RETURNED), and the turnaround found a cracked
// windshield (→ a new ACTIVE hold, which moved the vehicle to HELD). The geotab hold is finished
// and must not read as open; the windshield one must.
const active: GroupableHold = { status: 'ACTIVE' };
const returned: GroupableHold = { status: 'RETURNED' };
const repaired: GroupableHold = { status: 'REPAIRED' };
const voided: GroupableHold = { status: 'VOIDED' };
const releasedOut: GroupableHold = { status: 'RELEASED' };
const releasedBack: GroupableHold = { status: 'RELEASED', release: { actualReturn: '2026-07-23T12:00:00Z' } };

describe('holdGroup', () => {
  it('an ACTIVE hold is open — it is still flagging the car', () => {
    expect(holdGroup(active, 'HELD')).toBe('open');
  });

  it('a RELEASED hold with no return recorded is open — the car is out, the issue unresolved', () => {
    expect(holdGroup(releasedOut, 'OUT_ON_EXCEPTION')).toBe('open');
  });

  it('a RELEASED hold already back is closed', () => {
    expect(holdGroup(releasedBack, 'CLEAR')).toBe('closed');
  });

  it('REPAIRED and VOIDED are always closed', () => {
    expect(holdGroup(repaired, 'HELD')).toBe('closed');
    expect(holdGroup(voided, 'HELD')).toBe('closed');
  });

  // The distinction the whole module exists for: RETURNED is not "repaired", it is "came back,
  // re-evaluation owed" — so it stays surfaced only while the vehicle hasn't moved on.
  it('RETURNED still awaits re-eval while the vehicle is OUT_ON_EXCEPTION or RETURNED', () => {
    expect(holdGroup(returned, 'RETURNED')).toBe('re-eval');
    expect(holdGroup(returned, 'OUT_ON_EXCEPTION')).toBe('re-eval');
  });

  it('RETURNED is closed once the vehicle has moved on — the re-eval demonstrably happened', () => {
    // The real 5423777 shape: flagging the windshield moved the vehicle to HELD, which dropped it
    // out of ExceptionReturnSection's worklist.
    expect(holdGroup(returned, 'HELD')).toBe('closed');
    expect(holdGroup(returned, 'CLEAR')).toBe('closed');
    expect(holdGroup(returned, 'PRE_EXISTING')).toBe('closed');
  });
});

describe('isClosedHold', () => {
  it('is true only for the closed bucket — a re-eval hold is unfinished, not past', () => {
    expect(isClosedHold(returned, 'HELD')).toBe(true);
    expect(isClosedHold(returned, 'RETURNED')).toBe(false);
    expect(isClosedHold(active, 'HELD')).toBe(false);
  });
});

// Unit 5424395 (2026-07-23): plates were pulled off the fence on an assumption, the sale flag went
// on, the car went out on short term and came BACK — and only then was the mistake noticed. The
// old gate (ACTIVE or still-out EXCEPTION) had already hidden the undo button by that point.
describe('isClearableSaleFlag', () => {
  const sale = (status: string) => ({ status, holdTypes: ['sale_car'] } as never);

  it('offers the undo for a RETURNED sale flag — the live 5424395 gap', () => {
    expect(isClearableSaleFlag(sale('RETURNED'))).toBe(true);
  });

  it('still offers it while ACTIVE or out on a release (no regression)', () => {
    expect(isClearableSaleFlag(sale('ACTIVE'))).toBe(true);
    expect(isClearableSaleFlag(sale('RELEASED'))).toBe(true);
  });

  it('does not offer it once resolved — VOIDED is already cleared, REPAIRED is a real resolution', () => {
    expect(isClearableSaleFlag(sale('VOIDED'))).toBe(false);
    expect(isClearableSaleFlag(sale('REPAIRED'))).toBe(false);
  });

  it('never offers it for a non-sale hold', () => {
    expect(isClearableSaleFlag({ status: 'ACTIVE', holdTypes: ['damage'] } as never)).toBe(false);
    expect(isClearableSaleFlag({ status: 'ACTIVE', holdTypes: ['damage', 'mechanical'] } as never)).toBe(false);
  });

  it('offers it for a multi-type hold that includes sale_car', () => {
    expect(isClearableSaleFlag({ status: 'RETURNED', holdTypes: ['damage', 'sale_car'] } as never)).toBe(true);
  });
});

describe('groupHolds', () => {
  it('splits the live 5423777 case: windshield open, geotab closed', () => {
    const windshield = { ...active, id: 'windshield' };
    const geotab = { ...returned, id: 'geotab' };
    const { open, closed } = groupHolds([windshield, geotab], 'HELD');
    expect(open.map(h => h.id)).toEqual(['windshield']);
    expect(closed.map(h => h.id)).toEqual(['geotab']);
  });

  it('keeps a re-eval hold in the open bucket', () => {
    const { open, closed } = groupHolds([returned], 'RETURNED');
    expect(open).toHaveLength(1);
    expect(closed).toHaveLength(0);
  });

  it('preserves the caller ordering within each bucket', () => {
    const a = { ...active, id: 'a' };
    const b = { ...active, id: 'b' };
    const c = { ...repaired, id: 'c' };
    const d = { ...repaired, id: 'd' };
    const { open, closed } = groupHolds([a, c, b, d], 'HELD');
    expect(open.map(h => h.id)).toEqual(['a', 'b']);
    expect(closed.map(h => h.id)).toEqual(['c', 'd']);
  });

  it('handles the all-closed and empty cases', () => {
    expect(groupHolds([repaired, voided], 'CLEAR').open).toEqual([]);
    expect(groupHolds([], 'CLEAR')).toEqual({ open: [], closed: [] });
  });
});
