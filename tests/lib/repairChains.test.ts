import { describe, it, expect } from 'vitest';
import { linkedOpenExceptionChain, collapseRepairable } from '../../src/lib/repairChains';

interface H {
  id: string;
  status: string;
  flaggedAt: string;
  linkedHoldId?: string | null;
  release?: { releaseType: string; actualReturn?: string | null } | null;
}

const openException = (id: string, flaggedAt: string, linkedHoldId: string | null = null): H => ({
  id, flaggedAt, linkedHoldId, status: 'RELEASED', release: { releaseType: 'EXCEPTION', actualReturn: null },
});
const active = (id: string, flaggedAt: string, linkedHoldId: string | null = null): H => ({
  id, flaggedAt, linkedHoldId, status: 'ACTIVE', release: null,
});

// LZM532 on 2026-10-08: hail held Aug 28, released on exception, re-held Sep 30 with the link.
const aug = openException('aug28', '2026-08-28T15:16:49Z');
const sep = active('sep30', '2026-09-30T14:58:58Z', 'aug28');

describe('linkedOpenExceptionChain', () => {
  it('a re-hold reaches the open exception it stands for', () => {
    expect(linkedOpenExceptionChain(sep, [aug, sep])).toEqual([aug]);
  });

  it('no link → nothing (an unlinked hold is never matched)', () => {
    expect(linkedOpenExceptionChain(active('x', '2026-09-30T00:00:00Z'), [aug])).toEqual([]);
  });

  it('a chain of three returns both earlier exceptions, nearest first', () => {
    const a = openException('a', '2026-07-01T00:00:00Z');
    const b = openException('b', '2026-08-01T00:00:00Z', 'a');
    const c = active('c', '2026-09-01T00:00:00Z', 'b');
    expect(linkedOpenExceptionChain(c, [a, b, c]).map(h => h.id)).toEqual(['b', 'a']);
  });

  it('walks THROUGH a link that is already closed to an older open one', () => {
    const a = openException('a', '2026-07-01T00:00:00Z');
    const b: H = { ...openException('b', '2026-08-01T00:00:00Z', 'a'), status: 'RETURNED',
      release: { releaseType: 'EXCEPTION', actualReturn: '2026-08-20' } };
    const c = active('c', '2026-09-01T00:00:00Z', 'b');
    expect(linkedOpenExceptionChain(c, [a, b, c]).map(h => h.id)).toEqual(['a']);
  });

  it('a pre-existing or returned linked release is not an open exception', () => {
    const pre: H = { ...aug, release: { releaseType: 'PRE_EXISTING', actualReturn: null } };
    const back: H = { ...aug, release: { releaseType: 'EXCEPTION', actualReturn: '2026-09-01' } };
    expect(linkedOpenExceptionChain(sep, [pre, sep])).toEqual([]);
    expect(linkedOpenExceptionChain(sep, [back, sep])).toEqual([]);
  });

  it('a mechanical release, or a linked hold that is not released at all, is not an open exception', () => {
    const mech: H = { ...aug, release: { releaseType: 'MECHANICAL_RELEASE', actualReturn: null } };
    const stillActive: H = { ...aug, status: 'ACTIVE', release: null };
    expect(linkedOpenExceptionChain(sep, [mech, sep])).toEqual([]);
    expect(linkedOpenExceptionChain(sep, [stillActive, sep])).toEqual([]);
  });

  it('a link to a hold that is not there, or a loop, ends the walk', () => {
    expect(linkedOpenExceptionChain(active('c', '2026-09-01T00:00:00Z', 'ghost'), [aug])).toEqual([]);
    const a = openException('a', '2026-07-01T00:00:00Z', 'b');
    const b = openException('b', '2026-08-01T00:00:00Z', 'a');
    expect(linkedOpenExceptionChain(b, [a, b]).map(h => h.id)).toEqual(['a']);
  });
});

describe('collapseRepairable', () => {
  it('a linked re-hold and its earlier exception are ONE row', () => {
    const rows = collapseRepairable([sep, aug], [aug, sep]);
    expect(rows.map(r => r.hold.id)).toEqual(['sep30']);
    expect(rows[0].earlier.map(h => h.id)).toEqual(['aug28']);
  });

  it('same damage with NO link stays two rows (two hail holds can be two storms)', () => {
    const unlinked = active('sep30', '2026-09-30T14:58:58Z');
    const rows = collapseRepairable([unlinked, aug], [aug, unlinked]);
    expect(rows.map(r => r.hold.id)).toEqual(['sep30', 'aug28']);
    expect(rows.every(r => r.earlier.length === 0)).toBe(true);
  });

  it('a chain of three is one row carrying both earlier holds', () => {
    const a = openException('a', '2026-07-01T00:00:00Z');
    const b = openException('b', '2026-08-01T00:00:00Z', 'a');
    const c = active('c', '2026-09-01T00:00:00Z', 'b');
    const rows = collapseRepairable([c, b, a], [a, b, c]);
    expect(rows.map(r => r.hold.id)).toEqual(['c']);
    expect(rows[0].earlier.map(h => h.id)).toEqual(['b', 'a']);
  });

  it('an unrelated hold on the same car keeps its own row', () => {
    const chip = active('chip', '2026-10-01T00:00:00Z');
    const rows = collapseRepairable([sep, aug, chip], [aug, sep, chip]);
    expect(rows.map(r => r.hold.id)).toEqual(['sep30', 'chip']);
  });

  it('an earlier hold that is NOT an open exception is never folded away', () => {
    // Released as pre-existing: still repairable, and the repair would not close it.
    const pre: H = { ...aug, release: { releaseType: 'PRE_EXISTING', actualReturn: null } };
    const rows = collapseRepairable([sep, pre], [pre, sep]);
    expect(rows.map(r => r.hold.id)).toEqual(['sep30', 'aug28']);
  });

  it('a loop in the links can never fold every row away', () => {
    const a = openException('a', '2026-07-01T00:00:00Z', 'b');
    const b = openException('b', '2026-08-01T00:00:00Z', 'a');
    const rows = collapseRepairable([a, b], [a, b]);
    expect(rows.map(r => r.hold.id)).toEqual(['b']);
  });
});
