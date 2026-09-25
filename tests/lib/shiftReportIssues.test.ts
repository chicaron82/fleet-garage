import { describe, it, expect } from 'vitest';
import { shiftIssueLines } from '../../src/lib/shiftReportIssues';

// ⭐ His shift report lists every FAULT he opened today (migration 150) — a new issue, a reopen, or a
// fault added to a machine already down. The first version filtered on `reported_at`, which a reopen
// never changes, so the auto wash's snapped rinse pipe (2026-09-24, 17:02) was missing from his day.

const machine = (title: string, severity = 'high') => ({ title, severity });

describe('shiftIssueLines', () => {
  it('⭐ lists each fault he opened, with what broke', () => {
    expect(shiftIssueLines([
      { opened_at: '2026-09-24T22:02:00Z', note: 'Rinse pipe snapped off the arch', facility_issues: machine('Auto wash') },
    ])).toEqual([
      { reportedAt: '2026-09-24T22:02:00Z', title: 'Auto wash', severity: 'high', note: 'Rinse pipe snapped off the arch' },
    ]);
  });

  it('two faults on one machine in one day are two lines', () => {
    const lines = shiftIssueLines([
      { opened_at: '2026-09-24T22:02:00Z', note: 'Rinse pipe snapped', facility_issues: machine('Auto wash') },
      { opened_at: '2026-09-24T23:40:00Z', note: 'Wheel brush not spinning', facility_issues: machine('Auto wash') },
    ]);
    expect(lines.map(l => l.note)).toEqual(['Rinse pipe snapped', 'Wheel brush not spinning']);
  });

  it('orders the day by time', () => {
    const lines = shiftIssueLines([
      { opened_at: '2026-09-24T22:02:00Z', note: 'late', facility_issues: machine('A') },
      { opened_at: '2026-09-24T12:10:00Z', note: 'early', facility_issues: machine('B') },
    ]);
    expect(lines.map(l => l.title)).toEqual(['B', 'A']);
  });

  it('a new issue with no description does not repeat its title as the note', () => {
    const [line] = shiftIssueLines([{ opened_at: '2026-09-24T12:10:00Z', note: 'Bay light out', facility_issues: machine('Bay light out', 'medium') }]);
    expect(line).not.toHaveProperty('note');
  });

  it('drops a fault whose machine could not be read, rather than printing "undefined"', () => {
    expect(shiftIssueLines([{ opened_at: '2026-09-24T12:10:00Z', note: 'x', facility_issues: null }])).toEqual([]);
  });
});
