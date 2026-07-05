import { describe, it, expect } from 'vitest';
import { reminderCreatedAtISO } from '../../src/lib/whiteboardReminder';
import { shiftDateStr, shiftDayStartISO } from '../../src/lib/shiftDay';

// Mirrors WhiteboardView's shift_board auto-archive: a note is cleared when its
// created_at is strictly before this threshold for the shift-day being viewed.
const archiveThreshold = (viewedAt: Date) => shiftDayStartISO(shiftDateStr(0, viewedAt));
const isCleared = (createdAt: string, viewedAt: Date) => createdAt < archiveThreshold(viewedAt);

describe('reminderCreatedAtISO', () => {
  it('set in the evening → shows on the next shift, cleared the day after', () => {
    const createdAt = reminderCreatedAtISO(new Date('2026-07-04T23:00:00'));
    expect(isCleared(createdAt, new Date('2026-07-05T12:00:00'))).toBe(false); // shows on tomorrow's shift
    expect(isCleared(createdAt, new Date('2026-07-06T12:00:00'))).toBe(true);  // gone the day after
  });

  it('does not show on the same shift it was set (only the next one)', () => {
    const createdAt = reminderCreatedAtISO(new Date('2026-07-04T14:00:00'));
    // It's stamped in the future window, so it isn't part of THIS shift-day's board.
    expect(createdAt > new Date('2026-07-04T14:00:00').toISOString()).toBe(true);
  });

  it('post-midnight but pre-04:00 files under the next shift-day, not calendar +2', () => {
    // 01:00 is still inside the prior day's running shift; "next" is that day+1.
    const createdAt = reminderCreatedAtISO(new Date('2026-07-05T01:00:00'));
    expect(isCleared(createdAt, new Date('2026-07-05T12:00:00'))).toBe(false); // shows July-5 shift
    expect(isCleared(createdAt, new Date('2026-07-06T12:00:00'))).toBe(true);  // cleared July 6
  });
});
