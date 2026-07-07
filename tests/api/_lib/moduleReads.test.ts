import { describe, it, expect } from 'vitest';
import { formatMyShifts, formatLostFound, formatIssues } from '../../../api/_lib/moduleReads';

describe('formatMyShifts', () => {
  it('lists working shifts with a rough hours total, skipping off/pto', () => {
    expect(
      formatMyShifts([
        { dateLabel: 'Jun 26', shiftType: 'closing' },
        { dateLabel: 'Jun 27', shiftType: 'opening' },
        { dateLabel: 'Jun 28', shiftType: 'day-off' },
      ]),
    ).toBe("You're working 2 shifts: Closing Jun 26, Opening Jun 27 (~16h scheduled).");
  });

  it('reports nothing scheduled', () => {
    expect(formatMyShifts([{ dateLabel: 'Jun 28', shiftType: 'pto' }])).toBe(
      "You're not scheduled to work in this window.",
    );
  });
});

describe('formatLostFound', () => {
  const items = [
    { description: 'black backpack', location: 'seat 3B', foundLabel: 'Jun 25', plate: 'LFJ438' },
    { description: 'sunglasses', location: null, foundLabel: 'Jun 24', plate: null },
  ];
  it('lists items with location + plate', () => {
    const out = formatLostFound(items);
    expect(out).toContain('2 items in lost & found:');
    expect(out).toContain('black backpack (seat 3B) — plate LFJ438, found Jun 25');
    expect(out).toContain('sunglasses, found Jun 24');
  });
  it('reports empty / no match', () => {
    expect(formatLostFound([])).toBe('Nothing in lost & found right now.');
    expect(formatLostFound([], 'wallet')).toBe('Nothing in lost & found matching "wallet".');
  });
});

describe('formatIssues', () => {
  it('lists open issues with severity', () => {
    expect(
      formatIssues([
        { title: 'Broken vac hose, bay 2', severity: 'high', reportedLabel: 'Jun 26' },
        { title: 'Flickering light', severity: 'low', reportedLabel: 'Jun 25' },
      ]),
    ).toBe('2 open issues: Broken vac hose, bay 2 [high], reported Jun 26; Flickering light [low], reported Jun 25.');
  });
  it('reports none', () => {
    expect(formatIssues([])).toBe('No open facility issues.');
  });
});
