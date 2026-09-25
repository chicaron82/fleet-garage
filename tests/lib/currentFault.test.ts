import { describe, it, expect } from 'vitest';
import { currentFaultByIssue, currentPhotoByIssue, currentSpellByIssue, faultLine, type FaultEvent } from '../../src/lib/currentFault';

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

  // ⚠️⚠️ CORRECTED 2026-09-24 (ticket-the-current-spell). This test used to say a blank reopen is
  // SKIPPED and an older note wins — with a fixture that had no resolve between the reopens, which the
  // app cannot produce (a machine must be cleared to be reopened). With the resolve put back, that rule
  // resurrected a FIXED fault: the mat machine's real trail is reopened May 6 "tripping breaker" →
  // resolved May 8 "Fixed" → reopened Aug 4 with NO note, and the card said "Now: tripping breaker".
  // The newest reopen IS the current spell. A blank note means the cause wasn't recorded — never
  // an older fault brought back. (Still true: a blank never becomes the fault line.)
  it('⚠️ a blank newest reopen means "not recorded" — never an older, FIXED fault', () => {
    const trail = [
      ev({ note: 'Mat machine tripping breaker from time to time.', createdAt: '2026-05-06T10:00:00Z' }),
      ev({ eventType: 'resolved', note: 'Fixed', createdAt: '2026-05-08T10:00:00Z' }),
      ev({ note: null, createdAt: '2026-08-04T10:00:00Z' }),
    ];
    expect(currentFaultByIssue(trail).has('mat')).toBe(false);
    expect(currentSpellByIssue(trail).get('mat')?.at).toBe('2026-08-04T10:00:00Z');
  });

  it('a blank note never becomes the fault line, even whitespace', () => {
    expect(currentFaultByIssue([ev({ note: '   ' })]).has('mat')).toBe(false);
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

  // ⚠️ A REOPENED machine whose spell has no note must NOT fall back to the first fault — that is
  // April's (fixed) problem wearing today's clothes (ticket-the-current-spell).
  it('⚠️ a reopened spell with no note shows NO fault line, not the first fault', () => {
    expect(faultLine({ description: 'Keeps on tripping the outlet', status: 'reopened',
      reopenedAt: '2026-08-04T10:00:00Z' }, undefined)).toBeNull();
  });
});

// ⭐⭐ THE PICTURE BELONGS TO THE FAULT (2026-09-24, migration 149). Aaron, after the auto wash's
// rinse pipe snapped: *"couldn't … attach a new photo of it in the issue log."* The current photo is
// read off the SAME event as the current fault, so the card's picture and its "Now:" line can never
// describe two different breakdowns. docs/September/ticket-a-photo-per-fault.md
describe('currentPhotoByIssue', () => {
  it('⭐ is the photo on the reopen that IS the current fault', () => {
    const map = currentPhotoByIssue([
      ev({ issueId: 'wash', note: 'E-stop pressed', createdAt: '2026-06-08T10:00:00Z', photoUrl: 'june.jpg' }),
      ev({ issueId: 'wash', note: 'Rinse pipe snapped off the arch', createdAt: '2026-09-24T22:00:00Z', photoUrl: 'pipe.jpg' }),
    ]);
    expect(map.get('wash')).toBe('pipe.jpg');
  });

  it('⚠️ never an OLDER fault\'s photo when the current one has none', () => {
    const map = currentPhotoByIssue([
      ev({ issueId: 'wash', note: 'E-stop pressed', createdAt: '2026-06-08T10:00:00Z', photoUrl: 'june.jpg' }),
      ev({ issueId: 'wash', note: 'Rinse pipe snapped off the arch', createdAt: '2026-09-24T22:00:00Z' }),
    ]);
    expect(map.has('wash')).toBe(false);
  });

  it('reads the photo off the CURRENT spell — even when that spell\'s note was left blank', () => {
    const events = [
      ev({ issueId: 'wash', note: 'Rinse pipe snapped', createdAt: '2026-09-24T22:00:00Z', photoUrl: 'pipe.jpg' }),
      ev({ issueId: 'wash', eventType: 'resolved', note: 'Replaced pipe', createdAt: '2026-09-25T08:00:00Z' }),
      ev({ issueId: 'wash', note: null, createdAt: '2026-09-26T09:00:00Z', photoUrl: 'brush.jpg' }),
    ];
    expect(currentFaultByIssue(events).has('wash')).toBe(false);          // cause not recorded
    expect(currentPhotoByIssue(events).get('wash')).toBe('brush.jpg');    // but its picture is this spell's
  });
});

// ⭐ THE DAY COUNTER COUNTS THE SPELL, NOT THE MACHINE. Aaron, 2026-09-24: *"should it reset the day
// counter. currently reads like its Day 108, and its still down"* — the auto wash was first reported
// June 8; this breakdown began at 17:02 today.
describe('currentSpellByIssue', () => {
  it('⭐ starts at the newest reopen, and knows who reopened it', () => {
    const spell = currentSpellByIssue([
      ev({ issueId: 'aw', note: 'E-stop', createdAt: '2026-06-08T12:00:00Z', userId: 'u-old' }),
      ev({ issueId: 'aw', note: 'Rinse pipe snapped', createdAt: '2026-09-24T22:02:00Z', userId: 'u-aaron' }),
    ]).get('aw');
    expect(spell).toEqual({ at: '2026-09-24T22:02:00Z', by: 'u-aaron' });
  });

  it('a machine that never reopened has no spell — its counter stays on the first report', () => {
    expect(currentSpellByIssue([ev({ eventType: 'opened' })]).size).toBe(0);
  });
});
