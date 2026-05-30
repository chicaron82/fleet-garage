import { describe, it, expect } from 'vitest';
import { isNoteActiveForMonth, seasonalStarterBody, VISIBILITY_PRESETS } from '../../src/lib/whiteboard-schedule';
import type { WhiteboardNote } from '../../src/types';

function note(over: Partial<WhiteboardNote> = {}): WhiteboardNote {
  return { activeMonths: undefined, ...over } as WhiteboardNote;
}

// ── isNoteActiveForMonth ──────────────────────────────────────────────────────

describe('isNoteActiveForMonth', () => {
  it('a note with no activeMonths is always active', () => {
    expect(isNoteActiveForMonth(note(), 6)).toBe(true);
    expect(isNoteActiveForMonth(note({ activeMonths: [] }), 6)).toBe(true);
  });

  it('respects the activeMonths list', () => {
    const winter = note({ activeMonths: [11, 12, 1, 2] });
    expect(isNoteActiveForMonth(winter, 12)).toBe(true);
    expect(isNoteActiveForMonth(winter, 6)).toBe(false);
  });
});

// ── seasonalStarterBody ───────────────────────────────────────────────────────

describe('seasonalStarterBody', () => {
  it('differs by season', () => {
    expect(seasonalStarterBody(true)).toMatch(/Peak season/i);
    expect(seasonalStarterBody(false)).toMatch(/Winter/i);
  });
});

// ── VISIBILITY_PRESETS ────────────────────────────────────────────────────────

describe('VISIBILITY_PRESETS', () => {
  it('always = no month restriction', () => {
    expect(VISIBILITY_PRESETS.always.months).toEqual([]);
  });

  it('winter covers Nov–Apr, summer covers May–Oct', () => {
    expect(VISIBILITY_PRESETS.winter.months).toEqual([11, 12, 1, 2, 3, 4]);
    expect(VISIBILITY_PRESETS.summer.months).toEqual([5, 6, 7, 8, 9, 10]);
  });
});
