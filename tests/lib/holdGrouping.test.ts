import { describe, it, expect } from 'vitest';
import { holdGroup, isClosedHold, groupHolds } from '../../src/lib/holdGrouping';
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
