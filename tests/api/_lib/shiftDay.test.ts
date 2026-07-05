import { describe, it, expect } from 'vitest';
import { shiftBusinessDate } from '../../../api/_lib/shiftDay';

// Winnipeg summer = CDT (UTC-5). The whole point of these cases is the midnight→04:00
// window: those hours belong to the PREVIOUS shift-day, and a naive h24 read of
// midnight ("24") would break it. If Node's ICU ever flipped hour cycles, this fails.
describe('shiftBusinessDate — 04:00 Winnipeg cutover', () => {
  it('files the midnight→04:00 window under the PREVIOUS day (the mids case)', () => {
    expect(shiftBusinessDate(new Date('2026-07-05T05:30:00Z'))).toBe('2026-07-04'); // 00:30 CDT
    expect(shiftBusinessDate(new Date('2026-07-05T06:59:00Z'))).toBe('2026-07-04'); // 01:59 CDT
    expect(shiftBusinessDate(new Date('2026-07-05T08:59:00Z'))).toBe('2026-07-04'); // 03:59 CDT
  });

  it('files 04:00 onward under the SAME day', () => {
    expect(shiftBusinessDate(new Date('2026-07-05T09:01:00Z'))).toBe('2026-07-05'); // 04:01 CDT
    expect(shiftBusinessDate(new Date('2026-07-05T17:00:00Z'))).toBe('2026-07-05'); // 12:00 CDT
    expect(shiftBusinessDate(new Date('2026-07-06T04:59:00Z'))).toBe('2026-07-05'); // 23:59 CDT
  });

  it('rolls the previous day across a month boundary', () => {
    // 00:30 CDT on Jul 1 → belongs to Jun 30.
    expect(shiftBusinessDate(new Date('2026-07-01T05:30:00Z'))).toBe('2026-06-30');
  });
});
