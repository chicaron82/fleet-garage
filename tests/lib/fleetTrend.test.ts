import { describe, it, expect } from 'vitest';
import {
  cohortDeltas, describeBaseline, deltaLabel, registeredOn, toLocalDate,
  type FleetSnapshot,
} from '../../src/lib/fleetTrend';
import type { FleetCohortCounts } from '../../src/lib/fleetCohorts';

const counts = (o: Partial<FleetCohortCounts> = {}): FleetCohortCounts => ({
  'missing-keytag': 200, 'missing-keycount': 40, 'needs-backfill': 12, ...o,
});

const snap = (o: Partial<FleetSnapshot> = {}): FleetSnapshot => ({
  snapshotDate: '2026-08-16', total: 560,
  missingKeytag: 205, missingKeycount: 47, needsBackfill: 12, ...o,
});

describe('cohortDeltas', () => {
  it('reports movement per cohort, raw sign (now − then)', () => {
    expect(cohortDeltas(counts(), snap())).toEqual({
      'missing-keytag': -5,   // ground down
      'missing-keycount': -7,
      'needs-backfill': 0,    // held level
    });
  });

  it('goes positive when a gap GREW', () => {
    expect(cohortDeltas(counts({ 'needs-backfill': 19 }), snap())['needs-backfill']).toBe(7);
  });

  it('⭐ is all-null with no baseline — the honest day-one state, not an error', () => {
    // Nothing ever recorded WHEN a car stopped missing its keytag, so day one genuinely has
    // nothing to compare against. Nulls must render as absent arrows, never as zeros.
    expect(cohortDeltas(counts(), null)).toEqual({
      'missing-keytag': null, 'missing-keycount': null, 'needs-backfill': null,
    });
    expect(cohortDeltas(counts(), undefined)['missing-keytag']).toBeNull();
  });
});

describe('describeBaseline', () => {
  it('says "since yesterday" only when the baseline really is yesterday', () => {
    expect(describeBaseline('2026-08-16', '2026-08-17')).toBe('since yesterday');
  });

  it('⭐ names the REAL date across a gap instead of lying about yesterday', () => {
    // He opens the module on a Monday; the last snapshot is Friday's because he was off.
    // Calling that "since yesterday" would be a confident lie in a tool built to stop guessing.
    expect(describeBaseline('2026-08-14', '2026-08-17')).toMatch(/since Aug\s?14/);
  });

  it('returns empty with no baseline, a same-day baseline, or garbage', () => {
    expect(describeBaseline(null, '2026-08-17')).toBe('');
    expect(describeBaseline('2026-08-17', '2026-08-17')).toBe('');
    expect(describeBaseline('nonsense', '2026-08-17')).toBe('');
  });
});

describe('deltaLabel', () => {
  it('signs the number so direction is readable without colour alone', () => {
    expect(deltaLabel(7)).toBe('+7');
    expect(deltaLabel(-5)).toBe('-5');
  });

  it('⭐ renders NOTHING for zero or null — no change is not news', () => {
    // A row of grey 0s would bury the one or two chips that actually moved.
    expect(deltaLabel(0)).toBe('');
    expect(deltaLabel(null)).toBe('');
  });
});

describe('registeredOn', () => {
  it('counts the cars added on that local date', () => {
    const iso = (h: number) => new Date(2026, 7, 17, h).toISOString();
    expect(registeredOn([iso(7), iso(11), iso(14)], '2026-08-17')).toBe(3);
  });

  it('⭐ files a late-evening registration under its OWN day, not UTC tomorrow', () => {
    // 19:00 CDT is already the next UTC day. That car belongs to tonight's shift.
    const evening = new Date(2026, 7, 17, 19, 30).toISOString();
    expect(registeredOn([evening], '2026-08-17')).toBe(1);
    expect(registeredOn([evening], '2026-08-18')).toBe(0);
  });

  it('skips nulls and unparseable timestamps rather than throwing', () => {
    expect(registeredOn([null, undefined, 'nope'], '2026-08-17')).toBe(0);
  });
});

describe('toLocalDate', () => {
  it('formats local calendar date, zero-padded', () => {
    expect(toLocalDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
