import { describe, it, expect } from 'vitest';
import { rosteredVsaCount, presentVsaCount, blockCrewSide, keepCrewIfStillSide } from '../../src/lib/rosterCount';
import type { ShiftType, UserRole, Attendance, ExtraBlock } from '../../src/types';

const row = (userId: string, date: string, shiftType: ShiftType, role: UserRole, attendance?: Attendance) =>
  ({ userId, date, shiftType, user: { role }, attendance });

const DAY = '2026-06-15';

describe('rosteredVsaCount', () => {
  it('counts distinct VSAs in the requested window(s) on the date', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('b', DAY, 'opening', 'Lead VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(2);
  });

  it('ignores non-VSA roles', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('mgr', DAY, 'opening', 'Branch Manager'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('ignores other shift types and other dates', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('b', DAY, 'closing', 'VSA'),
      row('c', '2026-06-16', 'opening', 'VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('counts a person once even across multiple window types', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),
      row('a', DAY, 'closing', 'VSA'),
    ];
    expect(rosteredVsaCount(shifts, DAY, ['opening', 'closing'])).toBe(1);
  });

  it('dedupes a user who appears in duplicate rows for the same window', () => {
    const shifts = [row('a', DAY, 'opening', 'VSA'), row('a', DAY, 'opening', 'VSA')];
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(1);
  });

  it('is zero when nobody matches', () => {
    expect(rosteredVsaCount([], DAY, ['opening'])).toBe(0);
  });
});

// Aaron, 2026-11-04: *"Overtime hours for me were added today, so why still roster of 1?"* He opened, went home, and
// came back 18:00–21:00 to close with Khaiat. His fix: *"an explicit check to the added hours. ✅ If closing"*, made
// smart by when the hours sit (docs/ticket-plus-block-crew-tick.md).
describe('⭐ a ticked [+] block puts them on that crew', () => {
  const opener = (userId: string, more: ExtraBlock[], attendance?: Attendance) =>
    ({ ...row(userId, DAY, 'opening', 'VSA', attendance), extraBlocks: more });
  const back = (crew?: 'opening' | 'closing'): ExtraBlock => ({ start: '18:00', end: '21:00', ...(crew ? { crew } : {}) });
  const tonight = [opener('aaron', [back('closing')]), row('khaiat', DAY, 'closing', 'VSA', 'present')];

  it('⭐ tonight, ticked Closing crew: the roster shows 2', () => {
    expect(rosteredVsaCount(tonight, DAY, ['closing'])).toBe(2);
    expect(presentVsaCount(tonight, DAY, ['closing'])).toBe(2);
  });

  it('⭐ unticked, the block counts for nothing: his word, never a guess', () => {
    expect(rosteredVsaCount([opener('aaron', [back()]), row('khaiat', DAY, 'closing', 'VSA')], DAY, ['closing'])).toBe(1);
  });

  it('⭐ a closer who came in to help the morning counts toward the opening handoff', () => {
    const closer = { ...row('a', DAY, 'closing', 'VSA'), extraBlocks: [{ start: '06:45', end: '10:00', crew: 'opening' as const }] };
    expect(rosteredVsaCount([closer, row('b', DAY, 'opening', 'VSA')], DAY, ['opening'])).toBe(2);
  });

  it('a Closing tick never counts toward the opening', () => {
    expect(rosteredVsaCount(tonight, DAY, ['opening'])).toBe(1);
  });

  it('marked absent: on the roster, off the present count', () => {
    const shifts = [opener('a', [back('closing')], 'absent')];
    expect(rosteredVsaCount(shifts, DAY, ['closing'])).toBe(1);
    expect(presentVsaCount(shifts, DAY, ['closing'])).toBe(0);
  });
});

describe("blockCrewSide: the tick's label follows the times", () => {
  const b = (start: string): ExtraBlock => ({ start, end: '' });
  it('after the main hours: Closing; before them: Opening', () => {
    expect(blockCrewSide('06:45', '15:15', b('18:00'))).toBe('closing');
    expect(blockCrewSide('06:45', '15:15', b('15:15'))).toBe('closing');
    expect(blockCrewSide('13:30', '22:00', b('06:45'))).toBe('opening');
  });
  it('nothing to offer: no start yet, no main hours, or inside the shift', () => {
    expect(blockCrewSide('06:45', '15:15', b(''))).toBeNull();
    expect(blockCrewSide('', '', b('18:00'))).toBeNull();
    expect(blockCrewSide('06:45', '15:15', b('10:00'))).toBeNull();
  });
  it('a close past midnight: a block after it is still Closing', () => {
    expect(blockCrewSide('16:30', '01:00', b('01:30'))).toBe('closing');
  });
});

describe('keepCrewIfStillSide: an edit never re-points his tick', () => {
  it('kept while the block stays on its side', () => {
    const blk: ExtraBlock = { start: '18:00', end: '21:00', crew: 'closing' };
    expect(keepCrewIfStillSide('06:45', '15:15', blk)).toBe(blk);
  });
  it('dropped (not flipped) once the times move it', () => {
    expect(keepCrewIfStillSide('06:45', '15:15', { start: '05:00', end: '06:30', crew: 'closing' }))
      .toEqual({ start: '05:00', end: '06:30' });
  });
});

describe('presentVsaCount', () => {
  it('equals the roster when nobody is absent (unmarked + present both count)', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA'),               // unmarked → counts
      row('b', DAY, 'opening', 'VSA', 'present'),     // present  → counts
    ];
    expect(presentVsaCount(shifts, DAY, ['opening'])).toBe(2);
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(2); // roster unchanged
  });

  it('drops anyone marked absent (no-show/sick), so the rate divides by who showed', () => {
    const shifts = [
      row('a', DAY, 'opening', 'VSA', 'present'),
      row('b', DAY, 'opening', 'VSA', 'absent'),      // no-show → excluded
      row('c', DAY, 'opening', 'VSA'),                // unmarked → still counts
    ];
    expect(presentVsaCount(shifts, DAY, ['opening'])).toBe(2);
    expect(rosteredVsaCount(shifts, DAY, ['opening'])).toBe(3); // roster still 3 — the delta is the signal
  });
});
