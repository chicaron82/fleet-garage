import { describe, it, expect } from 'vitest';
import { findClopens } from '../../src/lib/scheduleClopens';

const d = (date: string, type: string) => ({ date, type });

describe('findClopens', () => {
  it('fires on an adjacent closing → opening', () => {
    expect(findClopens([d('2026-07-15', 'closing'), d('2026-07-16', 'opening')]))
      .toEqual([{ closeDate: '2026-07-15', openDate: '2026-07-16' }]);
  });

  it('does NOT fire when a day off sits between the close and the open', () => {
    // close Wed, off Thu, open Fri — the open isn't the day AFTER the close
    expect(findClopens([
      d('2026-07-15', 'closing'), d('2026-07-16', 'day-off'), d('2026-07-17', 'opening'),
    ])).toEqual([]);
  });

  it('does NOT fire across a weekend gap (Fri close → Mon open is not adjacent)', () => {
    expect(findClopens([d('2026-07-17', 'closing'), d('2026-07-20', 'opening')])).toEqual([]);
  });

  it('does NOT fire on the reverse (opening → closing)', () => {
    expect(findClopens([d('2026-07-15', 'opening'), d('2026-07-16', 'closing')])).toEqual([]);
  });

  it('does NOT fire close → mid or close → close', () => {
    expect(findClopens([
      d('2026-07-15', 'closing'), d('2026-07-16', 'mid'),
      d('2026-07-16', 'mid'), d('2026-07-17', 'closing'),
    ])).toEqual([]);
  });

  it('handles a month-boundary clopen (Jul 31 → Aug 1)', () => {
    expect(findClopens([d('2026-07-31', 'closing'), d('2026-08-01', 'opening')]))
      .toEqual([{ closeDate: '2026-07-31', openDate: '2026-08-01' }]);
  });

  it('finds every clopen in a block, in date order, from unsorted input', () => {
    // the real example: close, open, close, open, open  → 2 clopens (1→2 and 3→4)
    const week = [
      d('2026-07-16', 'opening'),
      d('2026-07-13', 'closing'),
      d('2026-07-17', 'opening'),
      d('2026-07-14', 'opening'),
      d('2026-07-15', 'closing'),
    ];
    expect(findClopens(week)).toEqual([
      { closeDate: '2026-07-13', openDate: '2026-07-14' },
      { closeDate: '2026-07-15', openDate: '2026-07-16' },
    ]);
  });

  it('the swapped week (open, open, close, open, open) has exactly one clopen', () => {
    const week = [
      d('2026-07-13', 'opening'), d('2026-07-14', 'opening'), d('2026-07-15', 'closing'),
      d('2026-07-16', 'opening'), d('2026-07-17', 'opening'),
    ];
    expect(findClopens(week)).toEqual([{ closeDate: '2026-07-15', openDate: '2026-07-16' }]);
  });

  it('returns [] for an empty schedule and ignores dateless cells', () => {
    expect(findClopens([])).toEqual([]);
    expect(findClopens([d('', 'closing'), d('', 'opening')])).toEqual([]);
  });
});
