import { describe, it, expect } from 'vitest';
import { shiftIssueLines } from '../../src/lib/shiftReportIssues';

// ⭐ A REOPEN IS A BREAKDOWN HE LOGGED TODAY (2026-09-24, ticket-reopens-invisible-downstream).
// Since 08d4bee a breakdown on a known machine is a REOPEN, not a new issue — and the shift report
// filtered on reported_at, which a reopen never changes. Today's auto wash (reopened 17:02, "Rinse
// pipe snapped off the arch") was missing from his own report.

const NEW = [{ reported_at: '2026-09-24T12:10:00Z', title: 'Bay light out', severity: 'medium' }];
const REOPEN = [{
  created_at: '2026-09-24T22:02:00Z', note: 'Rinse pipe snapped off the arch',
  facility_issues: { title: 'Auto wash', severity: 'high' },
}];

describe('shiftIssueLines', () => {
  it('⭐ includes the day\'s reopens, with the fault he wrote', () => {
    const lines = shiftIssueLines(NEW, REOPEN);
    expect(lines).toContainEqual({
      reportedAt: '2026-09-24T22:02:00Z', title: 'Auto wash', severity: 'high',
      reopenedFault: 'Rinse pipe snapped off the arch',
    });
  });

  it('keeps new issues exactly as before', () => {
    expect(shiftIssueLines(NEW, [])).toEqual([
      { reportedAt: '2026-09-24T12:10:00Z', title: 'Bay light out', severity: 'medium' },
    ]);
  });

  it('orders the whole list by time, new and reopened together', () => {
    const titles = shiftIssueLines(NEW, REOPEN).map(l => l.title);
    expect(titles).toEqual(['Bay light out', 'Auto wash']);
  });

  it('an old BLANK reopen still counts — it happened — it just has no fault to show', () => {
    const [line] = shiftIssueLines([], [{ ...REOPEN[0], note: null }]);
    expect(line.reopenedFault).toBe('');
  });

  it('drops a reopen whose machine could not be read, rather than printing "undefined"', () => {
    expect(shiftIssueLines([], [{ ...REOPEN[0], facility_issues: null }])).toEqual([]);
  });
});
