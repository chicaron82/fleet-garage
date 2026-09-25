import { describe, it, expect } from 'vitest';
import { openFaultsByIssue, downSince, faultsSummary, faultFromRow, type IssueFaultRow } from '../../../api/_lib/issueFaults';

// ⭐ A machine can be down for more than one reason (migration 150). The auto wash on 2026-09-24:
// the rinse pipe snapped that afternoon, and the passenger wheel brush had been dead ~a month.

const row = (over: Partial<IssueFaultRow>): IssueFaultRow => ({
  id: 'f', issue_id: 'aw', note: 'Rinse pipe snapped off the arch', photo_url: null,
  opened_at: '2026-09-24T22:02:00Z', opened_by: 'u1', cleared_at: null, ...over,
});

const PIPE = row({ id: 'pipe' });
const BRUSH = row({ id: 'brush', note: 'Passenger side wheel brush not spinning', opened_at: '2026-08-24T17:00:00Z' });

describe('openFaultsByIssue', () => {
  it('⭐ holds BOTH open faults on one machine, oldest first', () => {
    const aw = openFaultsByIssue([PIPE, BRUSH]).get('aw')!;
    expect(aw.map(f => f.id)).toEqual(['brush', 'pipe']);
  });

  it('a cleared fault is not open — the machine is down for what is left', () => {
    const aw = openFaultsByIssue([PIPE, { ...BRUSH, cleared_at: '2026-09-25T15:00:00Z' }]).get('aw')!;
    expect(aw.map(f => f.id)).toEqual(['pipe']);
  });

  it('a machine with every fault cleared has no entry at all', () => {
    expect(openFaultsByIssue([{ ...PIPE, cleared_at: '2026-09-25T15:00:00Z' }]).has('aw')).toBe(false);
  });

  it('keeps machines apart', () => {
    const map = openFaultsByIssue([PIPE, row({ id: 'mat', issue_id: 'mat', note: 'Eating mats' })]);
    expect([...map.keys()].sort()).toEqual(['aw', 'mat']);
  });
});

describe('downSince / faultsSummary', () => {
  const faults = [faultFromRow(PIPE), faultFromRow(BRUSH)];
  it('is down since its OLDEST open fault', () => {
    expect(downSince(faults)).toBe('2026-08-24T17:00:00Z');
    expect(downSince([])).toBeUndefined();
  });
  it('summarises every open fault in one line', () => {
    expect(faultsSummary(faults)).toBe('Rinse pipe snapped off the arch; Passenger side wheel brush not spinning');
  });
});

describe('faultFromRow', () => {
  it('omits an absent photo rather than carrying null', () => {
    expect(faultFromRow(PIPE)).not.toHaveProperty('photoUrl');
    expect(faultFromRow(row({ photo_url: 'https://cdn/p.jpg' })).photoUrl).toBe('https://cdn/p.jpg');
  });
});
