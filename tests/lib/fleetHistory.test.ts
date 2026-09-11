// The history module's models. Every one of these guards a way the screen could mislead him.
import { describe, it, expect } from 'vitest';
import {
  monthlyHolds, damageByClass, seenSpread, classCoverage, projectSightings, THIN_CLASS_FLEET,
  mostSeen, movement,
} from '../../src/lib/fleetHistory';

describe('monthlyHolds', () => {
  const now = new Date('2026-09-06T09:00:00');

  it('counts by calendar month, oldest first', () => {
    const rows = ['2026-04-10', '2026-04-20', '2026-05-01'].map(d => `${d}T12:00:00`);
    expect(monthlyHolds(rows, now).map(m => [m.label, m.count])).toEqual([['Apr', 2], ['May', 1]]);
  });

  it('⚠️ marks the CURRENT month partial — six days is not a quiet month', () => {
    const rows = ['2026-08-02T12:00:00', '2026-09-02T12:00:00'];
    const out = monthlyHolds(rows, now);
    expect(out.find(m => m.month === '2026-08')?.partial).toBe(false);
    expect(out.find(m => m.month === '2026-09')?.partial).toBe(true);
  });

  it('drops an unparseable timestamp rather than counting it as now', () => {
    expect(monthlyHolds(['not-a-date', '2026-07-01T00:00:00'], now)).toHaveLength(1);
  });
});

describe('damageByClass', () => {
  const fleet = (cls: string, n: number) => Array.from({ length: n }, () => ({ rentalClass: cls }));

  it('shares are hit over fleet, and an unclassed car joins no denominator', () => {
    const out = damageByClass([...fleet('B5', 10), { rentalClass: null }], { B5: 5 });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ rentalClass: 'B5', fleet: 10, hit: 5, share: 0.5 });
  });

  it(`⚠️ marks a class under ${THIN_CLASS_FLEET} cars as thin`, () => {
    const out = damageByClass([...fleet('T4', 4), ...fleet('C', 40)], { T4: 4, C: 4 });
    expect(out.find(c => c.rentalClass === 'T4')).toMatchObject({ thin: true, share: 1 });
    expect(out.find(c => c.rentalClass === 'C')?.thin).toBe(false);
  });

  it('⚠️⚠️ a thin 100% NEVER heads the list — position reads as importance before the marker does', () => {
    // T4 is 4-of-4; C is 4-of-40. Sorted purely by share, the anecdote would lead.
    const out = damageByClass([...fleet('T4', 4), ...fleet('C', 40)], { T4: 4, C: 4 });
    expect(out[0].rentalClass).toBe('C');
    expect(out[out.length - 1].rentalClass).toBe('T4');
  });

  it('a class nobody has flagged still appears, at zero', () => {
    expect(damageByClass(fleet('Z4', 20), {})[0]).toMatchObject({ hit: 0, share: 0 });
  });
});

describe('seenSpread', () => {
  it('buckets cars by how many times each was seen', () => {
    expect(seenSpread([1, 1, 2, 3, 3, 3])).toEqual([
      { times: 1, cars: 2, capped: false },
      { times: 2, cars: 1, capped: false },
      { times: 3, cars: 3, capped: false },
    ]);
  });

  it('caps the tail and flags the bucket, so the label can say "or more"', () => {
    const out = seenSpread([1, 5, 9, 12], 5);
    expect(out.find(b => b.times === 5)).toEqual({ times: 5, cars: 3, capped: true });
  });
});

describe('classCoverage', () => {
  const fleet = (cls: string, n: number) => Array.from({ length: n }, () => ({ rentalClass: cls }));

  it('⭐ perCar divides by MET cars, not the whole class', () => {
    // 3 of 10 met, 6 sightings between them → 2.0 each, not 0.6.
    const out = classCoverage(fleet('H4', 10), { H4: { met: 3, sightings: 6 } });
    expect(out[0]).toMatchObject({ met: 3, fleet: 10, share: 0.3, perCar: 2 });
  });

  it('a class FG has never met reads zero on both, not NaN', () => {
    expect(classCoverage(fleet('O6', 2), {})[0]).toMatchObject({ met: 0, share: 0, perCar: 0 });
  });
});

describe('projectSightings', () => {
  const observed = { days: 18, sightings: 908, cars: 422 };

  it('projects straight-line from the observed rate', () => {
    const [oct] = projectSightings(observed, 800, [{ label: 'early Oct', days: 42 }]);
    expect(oct.sightings).toBeGreaterThan(observed.sightings);
    expect(oct.multiple).toBeGreaterThan(observed.sightings / observed.cars);
  });

  it('⚠️⚠️ coverage SATURATES — the multiple must CLIMB, not stay flat', () => {
    // The bug this guards, caught on the render: projecting cars straight-line grew both halves
    // together, so a month out read the same 1.7× as today — contradicting the card's whole point.
    const nowMultiple = observed.sightings / observed.cars;
    const [month, eoy] = projectSightings(observed, 763, [
      { label: 'in a month', days: 48 }, { label: 'end of year', days: 134 },
    ]);
    expect(month.multiple).toBeGreaterThan(nowMultiple);
    expect(eoy.multiple).toBeGreaterThan(month.multiple);
  });

  it('⚠️ never projects more cars than the fleet holds', () => {
    const [eoy] = projectSightings(observed, 763, [{ label: 'end of year', days: 400 }]);
    expect(eoy.cars).toBeLessThanOrEqual(763);
  });

  it('⚠️ returns nothing rather than dividing by zero on an empty window', () => {
    expect(projectSightings({ days: 0, sightings: 0, cars: 0 }, 800, [{ label: 'x', days: 30 }]))
      .toEqual([]);
  });

  it('rounds coarsely — a forecast that reads precise is a forecast pretending to be a measurement', () => {
    const [p] = projectSightings(observed, 800, [{ label: 'early Oct', days: 42 }]);
    expect(p.sightings % 10).toBe(0);
    expect(p.cars % 5).toBe(0);
  });
});

describe('mostSeen', () => {
  const m = (o: Record<string, number>) => new Map(Object.entries(o));
  const ids = (...xs: string[]) => new Set(xs);
  const none = new Map<string, number>();
  const noTimes = new Map<string, string>();

  it('ranks by sightings, and tied counts share a place', () => {
    const r = mostSeen(m({ a: 5, b: 5, c: 4 }), none, noTimes, ids('a', 'b', 'c'));
    expect(r.rows.map(x => [x.vehicleId, x.rank, x.tiedWith])).toEqual([['a', 1, 2], ['b', 1, 2], ['c', 3, 1]]);
  });

  it('orders inside a tie by who came through last — display order, not rank', () => {
    const last = new Map([['a', '2026-09-01T00:00:00Z'], ['b', '2026-09-09T00:00:00Z']]);
    const r = mostSeen(m({ a: 5, b: 5 }), none, last, ids('a', 'b'));
    expect(r.rows.map(x => x.vehicleId)).toEqual(['b', 'a']);
    expect(r.rows.every(x => x.rank === 1)).toBe(true);
  });

  it('⭐ movement compares to the ranking as it stood a week ago', () => {
    // His example: the Wrangler takes the top spot this week, and the old #1 falls to #2.
    const r = mostSeen(m({ wrangler: 6, volvo: 5 }), m({ wrangler: 3, volvo: 4 }), noTimes, ids('wrangler', 'volvo'));
    expect(r.rows.map(x => [x.vehicleId, x.rank, x.prevRank])).toEqual([['wrangler', 1, 2], ['volvo', 2, 1]]);
  });

  it('a car FG had not met a week ago has no previous rank', () => {
    const r = mostSeen(m({ a: 2 }), none, noTimes, ids('a'));
    expect(r.rows[0].prevRank).toBeNull();
  });

  it('⚠️ cars outside the live fleet never rank, now or a week ago', () => {
    const r = mostSeen(m({ sold: 9, a: 2 }), m({ sold: 9, a: 1 }), noTimes, ids('a'));
    expect(r.rows.map(x => [x.vehicleId, x.rank, x.prevRank])).toEqual([['a', 1, 1]]);
  });

  it('⚠️ says how many more share the count at the cut, never drops them silently', () => {
    const r = mostSeen(m({ a: 5, b: 4, c: 4, d: 4, e: 1 }), none, noTimes, ids('a', 'b', 'c', 'd', 'e'), 2);
    expect(r.rows).toHaveLength(2);
    expect(r.moreTied).toBe(2);
  });
});

describe('movement', () => {
  it('reads new, same, up and down', () => {
    expect(movement({ rank: 3, prevRank: null })).toEqual({ kind: 'new' });
    expect(movement({ rank: 2, prevRank: 2 })).toEqual({ kind: 'same' });
    expect(movement({ rank: 1, prevRank: 3 })).toEqual({ kind: 'up', by: 2 });
    expect(movement({ rank: 2, prevRank: 1 })).toEqual({ kind: 'down', by: 1 });
  });
});
