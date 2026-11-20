// Aaron, 2026-11-04: *"Filters to show M, B, Erin"*, *"after 4 it just shows the last 3 cleaned the rest are
// collapsed"*, *"Display in reverse order most recent cleaned at the top"* (docs/ticket-bay-list-chip-filters-fold-
// newest-first.md).
import { describe, it, expect } from 'vitest';
import { bayListView } from '../../src/lib/bayListView';
import type { BayLine, BayLineKind } from '../../src/lib/lotBayLog';

const line = (id: number, kind: BayLineKind = 'clean'): BayLine =>
  ({ id, time: '', plate: `P${id}`, car: '', kind, label: '', note: '', memo: '', sentUp: false, sentAtExit: false, was: '' });
/** The day in the order the cars went in, the way bayLines hands it over. */
const day = (...kinds: BayLineKind[]) => kinds.map((k, i) => line(i + 1, k));
const ids = (ls: BayLine[]) => ls.map(l => l.id);

describe('⭐ newest on top', () => {
  it('reverses the day, so the car in the bay leads', () => {
    const v = bayListView(day('clean', 'erin', 'clean', 'bay'));
    expect(ids(v.shown)).toEqual([4, 3, 2, 1]);
    expect(v.folded).toEqual([]);
  });
});

describe('⭐ the chips filter', () => {
  const d = day('clean', 'erin', 'bhold', 'clean', 'mhold', 'erin', 'clean', 'clean', 'bay');

  it('Erin shows every Erin car, newest first, and never folds', () => {
    expect(bayListView(d, { filter: 'erin', fold: true })).toEqual({ shown: [d[5], d[1]], folded: [] });
  });

  it('B and M show their own kind only', () => {
    expect(ids(bayListView(d, { filter: 'bhold' }).shown)).toEqual([3]);
    expect(ids(bayListView(d, { filter: 'mhold' }).shown)).toEqual([5]);
  });
});

describe('⭐ the fold (FG)', () => {
  it('3 finished: nothing to fold', () => {
    expect(bayListView(day('clean', 'clean', 'clean'), { fold: true }).folded).toEqual([]);
  });

  it('⭐ 4 or more: the last 3 out, the rest folded, newest first', () => {
    const v = bayListView(day('clean', 'erin', 'clean', 'clean', 'clean', 'bay'), { fold: true });
    expect(ids(v.shown)).toEqual([6, 5, 4, 3]);
    expect(ids(v.folded)).toEqual([2, 1]);
  });

  it('the car in the bay never counts toward the 3, and never folds', () => {
    const v = bayListView(day('clean', 'clean', 'clean', 'clean', 'bay'), { fold: true });
    expect(ids(v.shown)).toEqual([5, 4, 3, 2]);
  });

  it('⭐ a row still waiting on Flag it never folds: it sits just under the 3', () => {
    const v = bayListView(day('bhold', 'clean', 'clean', 'clean', 'clean', 'clean'), { fold: true, pinned: new Set([1]) });
    expect(ids(v.shown)).toEqual([6, 5, 4, 1]);
    expect(ids(v.folded)).toEqual([3, 2]);
  });

  it('no fold asked (the read-only link, or unfolded): the whole day', () => {
    const v = bayListView(day('clean', 'clean', 'clean', 'clean', 'clean'));
    expect(ids(v.shown)).toEqual([5, 4, 3, 2, 1]);
    expect(v.folded).toEqual([]);
  });
});

// Aaron, 2026-11-20: *"How bout this also searching within the day"* (docs/ticket-bay-log-search-the-day.md).
describe('⭐ Find narrows the day', () => {
  const at = (id: number, plate: string, kind: BayLineKind = 'clean'): BayLine => ({ ...line(id, kind), plate });
  const d = [at(1, 'LUR525'), at(2, '0HL762', 'erin'), at(3, 'LUR224'), at(4, 'LUR316'), at(5, 'OHL525', 'bhold'), at(6, 'LZM569', 'bay')];

  it('shows every plate containing the key, newest first, never folded', () => {
    expect(bayListView(d, { plate: '525', fold: true })).toEqual({ shown: [d[4], d[0]], folded: [] });
  });

  it('O and 0 are one key, both ways', () => {
    expect(ids(bayListView(d, { plate: 'OHL' }).shown)).toEqual([5, 2]);
    expect(ids(bayListView(d, { plate: '0HL762' }).shown)).toEqual([2]);
  });

  it('a chip and the key both apply', () => {
    expect(ids(bayListView(d, { plate: '525', filter: 'bhold' }).shown)).toEqual([5]);
  });

  it('no match is an empty list, not the whole day', () => {
    expect(bayListView(d, { plate: 'ZZZ999', fold: true })).toEqual({ shown: [], folded: [] });
  });
});
