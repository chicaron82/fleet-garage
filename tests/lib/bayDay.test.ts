// The bay log's day record (docs/ticket-lot-lookout-bay-log.md, Phase 2): is it one of his logging days, and when did
// his shift run. (The VSA-count blocks were removed 2026-11-05 on his ask.)
import { describe, expect, it } from 'vitest';
import { dayMinute, dayStatus, myBayDay, windowsOf } from '../../src/lib/bayDay';
import type { Shift } from '../../src/types';

const sh = (userId: string, shiftType: Shift['shiftType'], start?: string, end?: string, extra: Partial<Shift> = {}): Shift =>
  ({ id: userId, userId, date: '2026-11-03', shiftType, startTime: start, endTime: end, createdAt: '', updatedAt: '', branchId: 'YWG', ...extra }) as Shift;

describe('dayMinute / windowsOf', () => {
  it('counts from the 04:00 cutover, so a close past midnight stays on its day', () => {
    expect(dayMinute('06:45')).toBe(165);
    expect(dayMinute('01:00')).toBe(1260);
  });
  it('logged hours win, and a [+] block is its own window', () => {
    const w = windowsOf({ startTime: '06:45', endTime: '15:15', actualEndTime: '16:00', extraBlocks: [{ start: '17:00', end: '21:00' }] });
    expect(w).toEqual([[165, 720], [780, 1020]]);
  });
});

describe('myBayDay', () => {
  it('his opener: working, and his window', () => {
    const r = myBayDay([sh('me', 'opening', '06:45', '15:15'), sh('a', 'opening', '06:45', '15:15')], 'me');
    expect(r).toEqual({ working: true, window: { start: '06:45', end: '15:15' } });
  });

  it('his day off, PTO, sick or a no-show: not a logging day', () => {
    for (const mine of [sh('me', 'day-off'), sh('me', 'pto'), sh('me', 'sick'), sh('me', 'opening', '06:45', '15:15', { attendance: 'absent' })]) {
      expect(myBayDay([mine, sh('a', 'opening', '06:45', '15:15')], 'me')).toEqual({ working: false, window: null });
    }
    expect(myBayDay([sh('a', 'opening', '06:45', '15:15')], 'me').working).toBe(false);
  });

  it('his logged late finish and his [+] block: the window follows what he worked', () => {
    const r = myBayDay([sh('me', 'opening', '06:45', '15:15', { actualEndTime: '16:00', extraBlocks: [{ start: '18:00', end: '21:00' }] })], 'me');
    expect(r.window).toEqual({ start: '06:45', end: '21:00' });
  });

  it('a close past midnight', () => {
    expect(myBayDay([sh('me', 'closing', '16:30', '01:00')], 'me').window).toEqual({ start: '16:30', end: '01:00' });
  });
});

describe('dayStatus', () => {
  const on = { working: true, window: { start: '06:45', end: '15:15' } };
  it('today after his window: ended; during it: nothing to add', () => {
    expect(dayStatus(on, true, '15:20')).toBe('Bay log ended 15:15');
    expect(dayStatus(on, true, '12:00')).toBeNull();
    expect(dayStatus(on, false, '15:20')).toBeNull();   // an earlier day doesn't "end" at today's clock
  });
  it('a close past midnight has not ended at 23:30', () => {
    expect(dayStatus({ ...on, window: { start: '16:30', end: '01:00' } }, true, '23:30')).toBeNull();
    expect(dayStatus({ ...on, window: { start: '16:30', end: '01:00' } }, true, '01:05')).toBe('Bay log ended 01:00');
  });
  it('a day he was off says so', () => {
    expect(dayStatus({ working: false, window: null }, false, '12:00')).toBe('Not a logging day: you were off.');
    expect(dayStatus(null, true, '12:00')).toBeNull();
  });
});
