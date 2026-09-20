import { describe, it, expect } from 'vitest';
import { currentFaultByIssue, faultLine, type FaultEvent } from '../../src/lib/currentFault';

// ⭐⭐ THE MACHINE IS THE RECORD (Aaron, 2026-09-20): *"instead of having a second mat machine issue
// for it eating mats, we'd just rename the record as mat machine, and what's currently wrong with it
// this time."* So the card's fault line has to be TODAY's fault, and the record's `description` —
// April's fault — must survive untouched underneath it.
// See docs/September/ticket-the-machine-is-the-record.md.

const ev = (over: Partial<FaultEvent>): FaultEvent =>
  ({ issueId: 'mat', eventType: 'reopened', note: 'eating the mats', createdAt: '2026-09-20T12:00:00Z', ...over });

describe('currentFaultByIssue', () => {
  it('⭐ the newest reopen note is what is wrong now', () => {
    const map = currentFaultByIssue([
      ev({ note: 'tripping the outlet', createdAt: '2026-08-04T10:00:00Z' }),
      ev({ note: 'eating the mats',     createdAt: '2026-09-20T10:00:00Z' }),
    ]);
    expect(map.get('mat')).toBe('eating the mats');
  });

  it('keeps each machine apart', () => {
    const map = currentFaultByIssue([
      ev({ issueId: 'mat', note: 'eating the mats' }),
      ev({ issueId: 'wash', note: 'passenger wheel brush stopped' }),
    ]);
    expect([...map]).toEqual([['mat', 'eating the mats'], ['wash', 'passenger wheel brush stopped']]);
  });

  // ⚠️ A `resolved` note says how it was FIXED — "Replaced gun handle", "E-stop was pressed. Reset"
  // — which is the opposite of what is wrong now. An `opened` note is the FIRST fault, and that
  // already lives in `description`.
  it('⚠️ ignores resolved and opened events entirely', () => {
    const map = currentFaultByIssue([
      ev({ eventType: 'reopened', note: 'eating the mats', createdAt: '2026-09-01T10:00:00Z' }),
      ev({ eventType: 'resolved', note: 'Replaced the roller', createdAt: '2026-09-19T10:00:00Z' }),
      ev({ eventType: 'opened',   note: 'tripping the outlet', createdAt: '2026-09-20T10:00:00Z' }),
    ]);
    expect(map.get('mat')).toBe('eating the mats');
  });

  // ⚠️ THE REAL DATA: both reopen events on file (2026-08-04) carry an empty note, because the field
  // was optional until today. A blank must not become the fault line.
  it('⚠️ a blank reopen note says nothing and is skipped', () => {
    const map = currentFaultByIssue([
      ev({ note: 'tripping the outlet', createdAt: '2026-08-01T10:00:00Z' }),
      ev({ note: '   ',                 createdAt: '2026-08-04T10:00:00Z' }),
      ev({ note: null,                  createdAt: '2026-08-05T10:00:00Z' }),
    ]);
    expect(map.get('mat')).toBe('tripping the outlet');
  });

  it('a machine that never reopened has no current fault', () => {
    expect(currentFaultByIssue([ev({ eventType: 'opened' })]).size).toBe(0);
  });

  it('trims what it returns', () => {
    expect(currentFaultByIssue([ev({ note: '  eating the mats  ' })]).get('mat')).toBe('eating the mats');
  });
});

describe('faultLine', () => {
  it('⭐ shows the current fault when there is one', () => {
    expect(faultLine({ description: 'tripping the outlet', status: 'reopened' }, 'eating the mats'))
      .toBe('eating the mats');
  });

  it('falls back to the first fault for a machine that only ever broke once', () => {
    expect(faultLine({ description: 'Needs better attachment', status: 'open' }, undefined))
      .toBe('Needs better attachment');
  });

  // ⚠️ A FIXED machine is not down, and printing the last thing that was wrong with it as if it
  // still were is the confident-and-stale line FG exists to remove.
  it('⚠️ a resolved machine has NO fault line', () => {
    expect(faultLine({ description: 'tripping the outlet', status: 'resolved' }, 'eating the mats'))
      .toBeNull();
  });

  it('says nothing rather than empty quotes when there is nothing to say', () => {
    expect(faultLine({ description: '   ', status: 'open' }, undefined)).toBeNull();
    expect(faultLine({ status: 'open' }, undefined)).toBeNull();
  });
});
