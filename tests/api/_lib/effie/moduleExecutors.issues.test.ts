import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { executeLookupIssues } from '../../../../api/_lib/effie/moduleExecutors';

// ⭐ Asked "what's open?", Effie said "Auto wash" — never that the rinse pipe had snapped off the arch.
// Since 08d4bee the machine is the record and the fault is what's wrong NOW. She now reads the reopen
// trail through the SAME rule the Issue Log card uses (api/_lib/currentFault).
// docs/September/ticket-reopens-invisible-downstream.md

/** A thenable query chain that answers with `rows` for one table, whatever filters are applied. */
function fakeSupabase(tables: Record<string, unknown[]>): SupabaseClient {
  return {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'order', 'eq', 'is']) chain[m] = () => chain;
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: tables[table] ?? [], error: null });
      return chain;
    },
  } as unknown as SupabaseClient;
}

const ISSUES = [
  { id: 'aw', title: 'Auto wash', severity: 'high', reported_at: '2026-06-08T11:48:00Z', cleared_at: null },
  { id: 'vac', title: 'Vacuum hose passenger side', severity: 'medium', reported_at: '2026-06-05T13:05:00Z', cleared_at: null },
];
const TRAIL = [
  { issue_id: 'aw', event_type: 'reopened', note: 'Rinse pipe snapped off the arch', created_at: '2026-09-24T22:02:00Z' },
];

describe('executeLookupIssues', () => {
  it('⭐ describes an open machine by what is wrong with it NOW', async () => {
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: ISSUES, issue_events: TRAIL }), {}));
    expect(out.summary).toContain('Auto wash [high] — now: Rinse pipe snapped off the arch');
  });

  it('a machine that only broke once reads exactly as before', async () => {
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: ISSUES, issue_events: TRAIL }), {}));
    expect(out.summary).toContain('Vacuum hose passenger side [medium], reported');
    expect(out.summary).not.toMatch(/Vacuum hose passenger side \[medium\] — now/);
  });

  it('a CLEARED machine is never described by its last fault', async () => {
    const cleared = [{ ...ISSUES[0], cleared_at: '2026-09-25T15:00:00Z' }];
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: cleared, issue_events: TRAIL }), { status: 'all' }));
    expect(out.summary).not.toContain('now:');
  });
});
