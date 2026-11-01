// The bay log's day record crew (docs/ticket-lot-lookout-bay-log.md, Phase 2): VSAs on, block by block, inside HIS
// shift. The schedule decides when, attendance decides whether; numbers only.
import { describe, expect, it } from 'vitest';
import { bayDayCrew, dayMinute, dayStatus, windowsOf } from '../../src/lib/bayCrewBlocks';
import type { Shift, UserRole } from '../../src/types';

const sh = (userId: string, shiftType: Shift['shiftType'], start?: string, end?: string, extra: Partial<Shift> = {}): Shift =>
  ({ id: userId, userId, date: '2026-11-03', shiftType, startTime: start, endTime: end, createdAt: '', updatedAt: '', branchId: 'YWG', ...extra }) as Shift;
const roles: Record<string, UserRole> = { me: 'Lead VSA', a: 'VSA', b: 'VSA', c: 'VSA', d: 'Driver' };
const role = (id: string) => roles[id] ?? null;

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

describe('bayDayCrew', () => {
  it('his opener with a second opener, a mid and a closer: blocks where the count changes', () => {
    const r = bayDayCrew([
      sh('me', 'opening', '06:45', '15:15'), sh('a', 'opening', '06:45', '15:15'),
      sh('b', 'mid', '10:00', '18:30'), sh('c', 'closing', '14:30', '23:00'), sh('d', 'opening', '07:00', '15:30'),
    ], 'me', role);
    expect(r.working).toBe(true);
    expect(r.window).toEqual({ start: '06:45', end: '15:15' });
    expect(r.blocks).toEqual([
      { start: '06:45', end: '10:00', vsas: 2 },
      { start: '10:00', end: '14:30', vsas: 3 },
      { start: '14:30', end: '15:15', vsas: 4 },
    ]);   // the driver never counts
  });

  it('absent drops someone; unmarked still counts; sick is out', () => {
    const r = bayDayCrew([
      sh('me', 'opening', '06:45', '15:15'), sh('a', 'opening', '06:45', '15:15', { attendance: 'absent' }),
      sh('b', 'opening', '06:45', '15:15'), sh('c', 'sick'),
    ], 'me', role);
    expect(r.blocks).toEqual([{ start: '06:45', end: '15:15', vsas: 2 }]);
  });

  it('an unknown person is never counted as a VSA (buildRowToShift would default them to VSA)', () => {
    const r = bayDayCrew([sh('me', 'opening', '06:45', '15:15'), sh('stranger', 'opening', '06:45', '15:15')], 'me', role);
    expect(r.blocks).toEqual([{ start: '06:45', end: '15:15', vsas: 1 }]);
  });

  it('his day off, PTO, sick or a no-show: not a logging day', () => {
    for (const mine of [sh('me', 'day-off'), sh('me', 'pto'), sh('me', 'sick'), sh('me', 'opening', '06:45', '15:15', { attendance: 'absent' })]) {
      expect(bayDayCrew([mine, sh('a', 'opening', '06:45', '15:15')], 'me', role)).toEqual({ working: false, window: null, blocks: [] });
    }
    expect(bayDayCrew([sh('a', 'opening', '06:45', '15:15')], 'me', role).working).toBe(false);
  });

  it('his logged late finish and his [+] block: the window and the blocks follow what he worked', () => {
    const r = bayDayCrew([
      sh('me', 'opening', '06:45', '15:15', { actualEndTime: '16:00', extraBlocks: [{ start: '18:00', end: '21:00' }] }),
      sh('c', 'closing', '14:30', '23:00'),
    ], 'me', role);
    expect(r.window).toEqual({ start: '06:45', end: '21:00' });
    expect(r.blocks).toEqual([
      { start: '06:45', end: '14:30', vsas: 1 },
      { start: '14:30', end: '16:00', vsas: 2 },
      { start: '18:00', end: '21:00', vsas: 2 },
    ]);
  });

  it('a close past midnight', () => {
    const r = bayDayCrew([sh('me', 'closing', '16:30', '01:00'), sh('a', 'closing', '14:30', '23:00')], 'me', role);
    expect(r.blocks).toEqual([{ start: '16:30', end: '23:00', vsas: 2 }, { start: '23:00', end: '01:00', vsas: 1 }]);
  });
});

describe('dayStatus', () => {
  const on = { working: true, window: { start: '06:45', end: '15:15' }, blocks: [] };
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
    expect(dayStatus({ working: false, window: null, blocks: [] }, false, '12:00')).toBe('Not a logging day: you were off.');
    expect(dayStatus(null, true, '12:00')).toBeNull();
  });
});
