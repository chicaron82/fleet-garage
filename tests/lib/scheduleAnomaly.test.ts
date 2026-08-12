import { describe, it, expect } from 'vitest';
import { scheduleAnomalies, type AnomalyDay } from '../../src/lib/scheduleAnomaly';
import type { ShiftType } from '../../src/types';

// Aaron's REAL baseline, measured 2026-07-16 over his last 12 weeks:
// Sun off 11/12 · Mon 0/12 · Tue 0/12 · Wed 2/12 · Thu 1/12 · Fri 0/12 · Sat off 12/12.
const BASE: Record<string, { offCount: number; sampleSize: number }> = {
  Sun: { offCount: 11, sampleSize: 12 },
  Mon: { offCount: 0,  sampleSize: 12 },
  Tue: { offCount: 0,  sampleSize: 12 },
  Wed: { offCount: 2,  sampleSize: 12 },
  Thu: { offCount: 1,  sampleSize: 12 },
  Fri: { offCount: 0,  sampleSize: 13 },
  Sat: { offCount: 12, sampleSize: 12 },
};

// His declared work week — the anchor the hook sets from the day-of-week (Mon–Fri worked).
const WORKDAYS = new Set(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

const day = (dayName: string, daysAway: number, shiftType: ShiftType, over: Partial<AnomalyDay> = {}): AnomalyDay => ({
  date: `2026-07-${String(18 + daysAway).padStart(2, '0')}`,
  dayName, daysAway, shiftType,
  normalWorkday: WORKDAYS.has(dayName),
  ...BASE[dayName],
  ...over,
});

describe('scheduleAnomalies — working a normally-off day', () => {
  it("Aaron's real break: an opening on a Sunday he's had off 11 of 12", () => {
    const out = scheduleAnomalies([day('Sat', 1, 'day-off'), day('Sun', 2, 'opening')]);
    expect(out).toEqual([{
      kind: 'anomaly-working',
      icon: '⚠️',
      label: 'You work Sun',
      detail: "You've had 11 of the last 12 Suns off.",
    }]);
  });

  it('says "tomorrow" when it is tomorrow, not the day name', () => {
    expect(scheduleAnomalies([day('Sun', 1, 'opening')])[0].label).toBe('You work tomorrow — Sun');
  });

  it('an ordinary week is silent — working Mon–Fri is not news', () => {
    expect(scheduleAnomalies([
      day('Mon', 1, 'opening'), day('Tue', 2, 'closing'), day('Wed', 3, 'mid'),
    ])).toEqual([]);
  });

  it('a normal Saturday off says nothing (he is always off — not an anomaly)', () => {
    expect(scheduleAnomalies([day('Sat', 1, 'day-off')])).toEqual([]);
  });
});

describe('scheduleAnomalies — off on a normally-worked day', () => {
  it("Aaron's real PTO: Fri off → Sat → Sun earns the long weekend", () => {
    const out = scheduleAnomalies([
      day('Thu', 1, 'mid'), day('Fri', 2, 'pto'), day('Sat', 3, 'day-off'), day('Sun', 4, 'day-off'),
    ]);
    expect(out).toEqual([{
      kind: 'anomaly-off',
      icon: '🎉',
      label: 'No work Fri',
      detail: '3 days off in a row — enjoy the long weekend.',
    }]);
  });

  it("counts the FULL off-block past the nag budget — Aaron's real 4-day stretch read as 3 (fixed 2026-07-29)", () => {
    // Jul 30 day-off · Jul 31 pto · Aug 1 day-off · Aug 2 day-off = 4 in a row. The old code reused
    // the 3-day nag window as the COUNT window and truncated it to 3. Nag budget (arg 2) bounds
    // what SURFACES; the count scans the whole array, so a 4th day past the budget still tallies.
    const out = scheduleAnomalies([
      day('Thu', 1, 'day-off'), day('Fri', 2, 'pto'), day('Sat', 3, 'day-off'), day('Sun', 4, 'day-off'),
    ], 3);
    expect(out).toHaveLength(1); // only the first (in-budget) day speaks
    expect(out[0].label).toBe('No work tomorrow');
    expect(out[0].detail).toBe('4 days off in a row — enjoy the long weekend.');
  });

  it('nag budget bounds SURFACING — a weekend shift 5 days out stays silent', () => {
    // The budget must still gate what shouts, even with a longer array passed for counting.
    const out = scheduleAnomalies([
      day('Mon', 1, 'mid'), day('Tue', 2, 'mid'), day('Wed', 3, 'mid'),
      day('Thu', 4, 'mid'), day('Sun', 5, 'opening'),
    ], 3);
    expect(out).toEqual([]);
  });

  it('pto and day-off BOTH count as not-working (different values, same meaning)', () => {
    // If pto were treated as a shift, the block would be 2 and the long weekend would vanish.
    const out = scheduleAnomalies([day('Fri', 1, 'pto'), day('Sat', 2, 'day-off'), day('Sun', 3, 'day-off')]);
    expect(out[0].detail).toContain('3 days off in a row');
  });

  it('a LONE day off never invents a weekend that is not there', () => {
    const out = scheduleAnomalies([day('Thu', 1, 'pto'), day('Fri', 2, 'opening')]);
    expect(out[0].label).toBe('No work tomorrow');
    expect(out[0].detail).toBe('Thu off (PTO) — you usually work it.');
    expect(out[0].detail).not.toContain('long weekend');
  });

  it('a lone PTO day is tagged (PTO); a plain day-off is not — booked time off stays legible', () => {
    const pto = scheduleAnomalies([day('Wed', 1, 'pto'), day('Thu', 2, 'opening')]);
    expect(pto[0].detail).toBe('Wed off (PTO) — you usually work it.');
    const off = scheduleAnomalies([day('Wed', 1, 'day-off'), day('Thu', 2, 'opening')]);
    expect(off[0].detail).toBe('Wed off — you usually work it.');
  });

  it('only the FIRST day of an off-block speaks — a 3-day break says it once', () => {
    const out = scheduleAnomalies([day('Fri', 1, 'pto'), day('Sat', 2, 'day-off'), day('Sun', 3, 'day-off')]);
    expect(out).toHaveLength(1);
  });

  it('a midweek day off DOES fire — he works Wed 10 of 12, so being off is worth knowing', () => {
    // Encodes the corrected reasoning: "has precedent" (2 of 12) is NOT the same as "not
    // surprising". 17% is rare, and the useful part is he doesn't set the alarm.
    const out = scheduleAnomalies([day('Wed', 1, 'day-off')]);
    expect(out).toEqual([{
      kind: 'anomaly-off',
      icon: '🎉',
      label: 'No work tomorrow',
      detail: 'Wed off — you usually work it.',
    }]);
  });

  it('the weekend staying the weekend is NOT news — Sat/Sun off never fire', () => {
    // The real false-positive guard: his ACTUAL normal days off must stay silent, or the card
    // would shout every single week and he'd learn to ignore it.
    expect(scheduleAnomalies([day('Sat', 1, 'day-off'), day('Sun', 2, 'day-off')])).toEqual([]);
  });
});

describe('scheduleAnomalies — the declared anchor (erosion-proof)', () => {
  it('a normally-worked day off STILL fires even when history has churned to 50% off', () => {
    // The whole reason for the declared week: under the old empirical model, a Wednesday off 6/12
    // (50%) would have gone silent ("Wednesday-off is normal now"). Declared Mon–Fri never erodes.
    const out = scheduleAnomalies([day('Wed', 1, 'day-off', { offCount: 6, sampleSize: 12 })]);
    expect(out).toEqual([{
      kind: 'anomaly-off', icon: '🎉', label: 'No work tomorrow',
      detail: 'Wed off — you usually work it.',
    }]);
  });

  it('a weekend shift fires on the DECLARED week even with no trustworthy history', () => {
    // Thin sample → the decision is still declared (Sunday isn't a workday), so it fires; the copy
    // just leans on the declared week instead of claiming "N of M" off three data points.
    const out = scheduleAnomalies([day('Sun', 1, 'opening', { offCount: 3, sampleSize: 3 })]);
    expect(out).toEqual([{
      kind: 'anomaly-working', icon: '⚠️', label: 'You work tomorrow — Sun',
      detail: "Sun isn't part of your usual Mon–Fri week.",
    }]);
  });

  it('both tones can fire in one window, in date order', () => {
    const out = scheduleAnomalies([
      day('Sun', 1, 'opening'),           // ⚠️ works a normally-off day
      day('Mon', 2, 'closing'),
      day('Tue', 3, 'closing'),
      day('Wed', 4, 'mid'),
      day('Thu', 5, 'mid'),
      day('Fri', 6, 'pto'),               // 🎉 off on a normally-worked day
      day('Sat', 7, 'day-off'),
    ]);
    expect(out.map(i => i.kind)).toEqual(['anomaly-working', 'anomaly-off']);
  });
});
