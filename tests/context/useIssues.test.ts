// Behaviour-locking net for the addIssue write path — proves the shared submit
// lock (src/lib/submitLock.ts) stops a double-tapped facility issue from filing
// twice. The IssueLogView handler never gated on its submitting flag, so this is
// the write-layer guarantee. Other useIssues ops are update-shaped (converge).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { User } from '../../src/types';

const { writeWithRefreshMock, uploadIssuePhotoMock } = vi.hoisted(() => ({
  writeWithRefreshMock: vi.fn(),
  uploadIssuePhotoMock: vi.fn(),
}));

const fromCalls: string[] = [];
const chain = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  eq:     vi.fn(() => chain),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (table: string) => { fromCalls.push(table); return chain; } },
  writeWithRefresh: (...args: unknown[]) => writeWithRefreshMock(...args),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  uploadIssuePhoto: (...args: unknown[]) => uploadIssuePhotoMock(...args),
}));

import { useIssues } from '../../src/context/useIssues';

const USER = { id: 'u-1', name: 'Test VSA', branchId: 'YWG' } as unknown as User;

function makeSlice() {
  const { result } = renderHook(() => useIssues(USER, 'YWG'));
  return result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  fromCalls.length = 0;
  writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { error: null }; });
  uploadIssuePhotoMock.mockResolvedValue('https://cdn.test/issue.jpg');
});

describe('addIssue', () => {
  it('inserts the facility issue and opens an event', async () => {
    const slice = makeSlice();

    await slice.addIssue({ title: 'Broken bay door', severity: 'medium' });

    expect(fromCalls).toContain('facility_issues');
    expect(fromCalls).toContain('issue_events');
  });

  it('double-submit in the same frame files exactly one issue (shared lock)', async () => {
    // Keyed per reporter+title — the second identical tap is dropped before any insert.
    const slice = makeSlice();

    const p1 = slice.addIssue({ title: 'Flickering light', severity: 'low' });
    const p2 = slice.addIssue({ title: 'Flickering light', severity: 'low' }); // lock held → dropped
    await Promise.all([p1, p2]);

    expect(fromCalls.filter(t => t === 'facility_issues')).toHaveLength(1);
  });
});
