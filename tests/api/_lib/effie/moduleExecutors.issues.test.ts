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
const FAULTS = [
  { id: 'pipe', issue_id: 'aw', note: 'Rinse pipe snapped off the arch', photo_url: null,
    opened_at: '2026-09-24T22:02:00Z', opened_by: 'u1', cleared_at: null },
  { id: 'brush', issue_id: 'aw', note: 'Passenger side wheel brush not spinning', photo_url: null,
    opened_at: '2026-08-24T17:00:00Z', opened_by: 'u1', cleared_at: null },
];

describe('executeLookupIssues', () => {
  it('⭐ describes an open machine by EVERY fault it has NOW (migration 150)', async () => {
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: ISSUES, issue_faults: FAULTS }), {}));
    expect(out.summary).toContain('Auto wash [high] — now: Passenger side wheel brush not spinning; Rinse pipe snapped off the arch');
  });

  it('a machine with no open faults on file reads exactly as before', async () => {
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: ISSUES, issue_faults: FAULTS }), {}));
    expect(out.summary).toContain('Vacuum hose passenger side [medium], reported');
    expect(out.summary).not.toMatch(/Vacuum hose passenger side \[medium\] — now/);
  });

  it('a CLEARED machine is never described by its last fault', async () => {
    const cleared = [{ ...ISSUES[0], cleared_at: '2026-09-25T15:00:00Z' }];
    const out = JSON.parse(await executeLookupIssues(fakeSupabase({ facility_issues: cleared, issue_faults: FAULTS }), { status: 'all' }));
    expect(out.summary).not.toContain('now:');
  });
});
