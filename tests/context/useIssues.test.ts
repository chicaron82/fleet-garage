// Behaviour-locking net for the addIssue write path — proves the shared submit
// lock (src/lib/submitLock.ts) stops a double-tapped facility issue from filing
// twice. The IssueLogView handler never gated on its submitting flag, so this is
// the write-layer guarantee. Other useIssues ops are update-shaped (converge).

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from '../../src/types';

const { writeWithRefreshMock, uploadIssuePhotoMock, uploadFaultPhotoMock } = vi.hoisted(() => ({
  writeWithRefreshMock: vi.fn(),
  uploadIssuePhotoMock: vi.fn(),
  uploadFaultPhotoMock: vi.fn(),
}));
// What the reopen trail read returns — the events the fault-aware attach must choose among.
let trailRows: Record<string, unknown>[] = [];

const fromCalls: string[] = [];
const chain = {
  insert: vi.fn(() => chain),
  update: vi.fn(() => chain),
  eq:     vi.fn(() => chain),
  select: vi.fn(() => chain),
  // Awaiting the chain after .select().eq().eq() resolves to the trail rows.
  then: (resolve: (v: unknown) => unknown) => resolve({ data: trailRows, error: null }),
};

vi.mock('../../src/lib/supabase', () => ({
  supabase: { from: (table: string) => { fromCalls.push(table); return chain; } },
  writeWithRefresh: (...args: unknown[]) => writeWithRefreshMock(...args),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  uploadIssuePhoto: (...args: unknown[]) => uploadIssuePhotoMock(...args),
  uploadIssueFaultPhoto: (...args: unknown[]) => uploadFaultPhotoMock(...args),
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
  uploadFaultPhotoMock.mockResolvedValue('https://cdn.test/fault.jpg');
  trailRows = [];
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

// ⭐ A PHOTO PER FAULT (2026-09-24, migration 149). Aaron, after the auto wash's rinse pipe snapped:
// *"couldn't … attach a new photo of it in the issue log."* docs/September/ticket-a-photo-per-fault.md
describe('reopenIssue — the fault carries its own photo', () => {
  it('uploads to the FAULT path and stores the url on the reopen event', async () => {
    const slice = makeSlice();
    await slice.reopenIssue('aw', 'Rinse pipe snapped off the arch', 'data:PIPE');
    expect(uploadFaultPhotoMock).toHaveBeenCalledWith('data:PIPE', 'aw');
    expect(uploadIssuePhotoMock).not.toHaveBeenCalled();         // never the issue's one fixed path
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'reopened', note: 'Rinse pipe snapped off the arch', photo_url: 'https://cdn.test/fault.jpg',
    }));
  });

  it('without a photo the event says so (null), and nothing is uploaded', async () => {
    const slice = makeSlice();
    await slice.reopenIssue('aw', 'Rinse pipe snapped off the arch');
    expect(uploadFaultPhotoMock).not.toHaveBeenCalled();
    expect(chain.insert).toHaveBeenCalledWith(expect.objectContaining({ photo_url: null }));
  });
});

describe('attachPhoto — follows the fault', () => {
  function sliceWith(issue: Record<string, unknown>) {
    const { result } = renderHook(() => useIssues(USER, 'YWG'));
    act(() => result.current.setFacilityIssues([issue as never]));
    return result;
  }

  it('⭐ a machine with a CURRENT fault: the photo lands on THAT fault\'s event', async () => {
    // A REAL trail (ticket-the-current-spell): every reopen follows a resolve, so the NEWEST reopen is
    // the current spell. The query filters to reopens; the resolves between them just aren't fetched.
    trailRows = [
      { id: 'ev-may', issue_id: 'aw', event_type: 'reopened', note: 'Brush jammed', created_at: '2026-05-08T10:00:00Z' },
      { id: 'ev-pipe', issue_id: 'aw', event_type: 'reopened', note: 'Rinse pipe snapped', created_at: '2026-09-24T22:00:00Z' },
    ];
    const r = sliceWith({ id: 'aw', branchId: 'YWG', title: 'Auto wash', status: 'reopened', reopenCount: 2,
      currentFault: 'Rinse pipe snapped', reopenedAt: '2026-09-24T22:00:00Z', photoUrl: 'june.jpg' });
    await act(() => r.current.attachPhoto('aw', 'data:PIPE'));
    expect(uploadFaultPhotoMock).toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith({ photo_url: 'https://cdn.test/fault.jpg' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'ev-pipe');   // the CURRENT spell — the newest reopen
    expect(r.current.facilityIssues[0].currentPhoto).toBe('https://cdn.test/fault.jpg');
    expect(r.current.facilityIssues[0].photoUrl).toBe('june.jpg');   // the first fault's photo survives
  });

  it('a machine that has only broken once: the photo is the issue\'s own, as before', async () => {
    const r = sliceWith({ id: 'door', branchId: 'YWG', title: 'Bay door', status: 'open', reopenCount: 0 });
    await act(() => r.current.attachPhoto('door', 'data:DOOR'));
    expect(uploadIssuePhotoMock).toHaveBeenCalledWith('data:DOOR', 'door');
    expect(uploadFaultPhotoMock).not.toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith({ photo_url: 'https://cdn.test/issue.jpg' });
  });
});

// ⭐ The optimistic reopen IS the new spell — never carrying the previous one's fault or photo.
describe('reopenIssue — the optimistic card is the new spell', () => {
  it('a blank note leaves NO current fault, not the previous spell\'s', async () => {
    const { result } = renderHook(() => useIssues(USER, 'YWG'));
    act(() => result.current.setFacilityIssues([{ id: 'mat', branchId: 'YWG', title: 'Mat machine',
      status: 'resolved', reopenCount: 1, currentFault: 'tripping breaker', currentPhoto: 'may.jpg' } as never]));
    await act(() => result.current.reopenIssue('mat'));
    const mat = result.current.facilityIssues[0];
    expect(mat.currentFault).toBeUndefined();
    expect(mat.currentPhoto).toBeUndefined();
    expect(mat.reopenedAt).toBeDefined();
    expect(mat.reopenedById).toBe('u-1');
  });
});
