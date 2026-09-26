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
  is:     vi.fn(() => chain),
  single: vi.fn(() => chain),
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
  // A saved insert().select('id').single() answers with the new row's id — the fault writer requires it.
  writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { data: { id: 'f-new' }, error: null }; });
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

// ⭐⭐ FAULTS AS ROWS (migration 150). The machine is open while any fault is; each fault has its own
// note, photo and Clear. Aaron, 2026-09-24: *"there's also another issue for the auto wash."*
// docs/September/ticket-faults-as-rows.md
const faultInsert = () => (chain.insert.mock.calls as unknown as [Record<string, unknown>][])
  .map(c => c[0]).find(r => 'opened_by' in r);

function sliceWith(issues: Record<string, unknown>[]) {
  const { result } = renderHook(() => useIssues(USER, 'YWG'));
  act(() => result.current.setFacilityIssues(issues.map(i => ({ branchId: 'YWG', reopenCount: 0, ...i })) as never));
  return result;
}
const F = (id: string, issueId = 'aw') => ({ id, issueId, note: id, openedAt: '2026-09-24T22:00:00Z', openedBy: 'u-1' });

describe('addIssue — opens its FIRST fault', () => {
  it('writes a fault carrying the description', async () => {
    await makeSlice().addIssue({ title: 'Bay door', description: 'Won\'t close', severity: 'high' });
    expect(faultInsert()).toMatchObject({ note: "Won't close", opened_by: 'u-1' });
  });
  it('with no description, the fault is the title', async () => {
    await makeSlice().addIssue({ title: 'Bay light out', severity: 'low' });
    expect(faultInsert()).toMatchObject({ note: 'Bay light out' });
  });
});

describe('reopenIssue — a new fault, with its own photo', () => {
  it('uploads to the FAULT path, writes the fault, and reopens the machine', async () => {
    const r = sliceWith([{ id: 'aw', status: 'resolved', faults: [] }]);
    await act(() => r.current.reopenIssue('aw', 'Rinse pipe snapped off the arch', 'data:PIPE'));
    expect(uploadFaultPhotoMock).toHaveBeenCalledWith('data:PIPE', 'aw');
    expect(faultInsert()).toMatchObject({ issue_id: 'aw', note: 'Rinse pipe snapped off the arch', photo_url: 'https://cdn.test/fault.jpg' });
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'reopened' }));
    expect(r.current.facilityIssues[0].faults?.map(f => f.note)).toEqual(['Rinse pipe snapped off the arch']);
  });
  it('a blank reopen is recorded as "Not recorded", never an older fault', async () => {
    const r = sliceWith([{ id: 'mat', status: 'resolved', faults: [] }]);
    await act(() => r.current.reopenIssue('mat'));
    expect(faultInsert()).toMatchObject({ note: 'Not recorded' });
  });
});

describe('addFault — one MORE thing wrong', () => {
  it('⭐ on a machine already down: adds a fault, does NOT touch the machine', async () => {
    const r = sliceWith([{ id: 'aw', status: 'reopened', faults: [F('pipe')] }]);
    await act(() => r.current.addFault('aw', 'Passenger side wheel brush not spinning'));
    expect(faultInsert()).toMatchObject({ note: 'Passenger side wheel brush not spinning' });
    expect(chain.update).not.toHaveBeenCalled();
    expect(r.current.facilityIssues[0].faults).toHaveLength(2);
  });
  it('on a CLEARED machine: that is a reopen — one path, not two', async () => {
    const r = sliceWith([{ id: 'aw', status: 'resolved', faults: [] }]);
    await act(() => r.current.addFault('aw', 'Brush dead'));
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'reopened' }));
  });
});

describe('clearFault — one fixed, the machine stays down for the rest', () => {
  it('⭐ clearing one of two closes THAT fault only; the machine stays open', async () => {
    const r = sliceWith([{ id: 'aw', status: 'reopened', faults: [F('brush'), F('pipe')] }]);
    await act(() => r.current.clearFault(F('pipe') as never, 'New pipe fitted'));
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ clear_note: 'New pipe fitted' }));
    expect(chain.eq).toHaveBeenCalledWith('id', 'pipe');
    expect(chain.update).not.toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved' }));
    expect(r.current.facilityIssues[0].faults?.map(f => f.id)).toEqual(['brush']);
    expect(r.current.facilityIssues[0].status).toBe('reopened');
  });
  it('⭐ clearing the LAST fault clears the machine', async () => {
    const r = sliceWith([{ id: 'aw', status: 'reopened', faults: [F('brush')] }]);
    await act(() => r.current.clearFault(F('brush') as never));
    expect(chain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'resolved' }));
    expect(r.current.facilityIssues[0].status).toBe('resolved');
    expect(r.current.facilityIssues[0].faults).toEqual([]);
  });
});

describe('attachFaultPhoto', () => {
  it('uploads to the fault path and writes THAT fault only', async () => {
    const r = sliceWith([{ id: 'aw', status: 'reopened', faults: [F('brush'), F('pipe')] }]);
    await act(() => r.current.attachFaultPhoto(F('pipe') as never, 'data:PIPE'));
    expect(chain.update).toHaveBeenCalledWith({ photo_url: 'https://cdn.test/fault.jpg' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'pipe');
    const faults = r.current.facilityIssues[0].faults!;
    expect(faults.find(f => f.id === 'pipe')?.photoUrl).toBe('https://cdn.test/fault.jpg');
    expect(faults.find(f => f.id === 'brush')?.photoUrl).toBeUndefined();
  });
});

describe('the double-tap lock on a new fault', () => {
  it('two same-frame "+ Add fault" taps add it ONCE', async () => {
    const r = sliceWith([{ id: 'aw', status: 'reopened', faults: [F('pipe')] }]);
    await act(() => Promise.all([
      r.current.addFault('aw', 'Brush dead'), r.current.addFault('aw', 'Brush dead'),
    ]).then(() => undefined));
    const faultInserts = (chain.insert.mock.calls as unknown as [Record<string, unknown>][]).filter(c => 'opened_by' in c[0]);
    expect(faultInserts).toHaveLength(1);
  });
});

// ⭐ Reflection 81 (2026-09-25): the fault writes were the "writes that vanish" defect again. A failed
// insert put a fault on the card under a made-up id; a failed clear or reopen said nothing. They throw
// now, and the tap sites say "didn't save" (useWriteGuard).
describe('a write that did not land is not reported as landed', () => {
  it('⭐ a fault that fails to save throws, and is not added to the machine', async () => {
    const { result } = renderHook(() => useIssues(USER, 'YWG'));
    act(() => { result.current.setFacilityIssues([{ id: 'i-1', branchId: 'YWG', title: 'Auto wash', severity: 'high', reportedById: 'u-1', reportedAt: '2026-09-01', status: 'open', reopenCount: 0, faults: [] } as never]); });
    writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { data: null, error: { message: 'offline' } }; });
    await expect(act(() => result.current.addFault('i-1', 'Leaking at the joints'))).rejects.toThrow();
    expect(result.current.facilityIssues[0].faults).toEqual([]);
  });

  it('a clear that fails throws, and the fault stays on the card', async () => {
    const { result } = renderHook(() => useIssues(USER, 'YWG'));
    const f1 = { id: 'f1', issueId: 'i-1', note: 'Brush', openedAt: '2026-08-24', openedBy: 'u-1' };
    const f2 = { id: 'f2', issueId: 'i-1', note: 'Pipe', openedAt: '2026-09-24', openedBy: 'u-1' };
    act(() => { result.current.setFacilityIssues([{ id: 'i-1', branchId: 'YWG', title: 'Auto wash', severity: 'high', reportedById: 'u-1', reportedAt: '2026-08-01', status: 'open', reopenCount: 0, faults: [f1, f2] } as never]); });
    writeWithRefreshMock.mockImplementation(async (fn: () => unknown) => { fn(); return { data: null, error: { message: 'offline' } }; });
    await expect(act(() => result.current.clearFault(f2))).rejects.toThrow();
    expect(result.current.facilityIssues[0].faults).toHaveLength(2);
  });
});
