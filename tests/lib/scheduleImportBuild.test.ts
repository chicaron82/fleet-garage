import { describe, it, expect } from 'vitest';
import { addDaysISO, buildImportShifts, nextType, type ImportRow } from '../../src/lib/scheduleImportBuild';
import type { ShiftType } from '../../src/types';

const defaults: Record<ShiftType, { start: string; end: string }> = {
  opening: { start: '06:45', end: '15:15' },
  mid: { start: '10:00', end: '18:00' },
  closing: { start: '14:30', end: '23:00' },
  'day-off': { start: '', end: '' },
  pto: { start: '', end: '' },
  sick: { start: '', end: '' },
};
const isFullDay = (t: ShiftType) => t === 'day-off' || t === 'pto' || t === 'sick';

describe('addDaysISO', () => {
  it('adds days across a month boundary', () => {
    expect(addDaysISO('2026-06-29', 0)).toBe('2026-06-29');
    expect(addDaysISO('2026-06-29', 4)).toBe('2026-07-03');
    expect(addDaysISO('2026-06-29', 6)).toBe('2026-07-05');
  });
});

describe('buildImportShifts', () => {
  it('maps each column to weekStart+i with default times; full-day types carry none', () => {
    const rows: ImportRow[] = [{ userId: 'u1', types: ['opening', 'day-off', 'closing'] }];
    expect(buildImportShifts(rows, '2026-06-29', defaults, isFullDay)).toEqual([
      { userId: 'u1', date: '2026-06-29', shiftType: 'opening', startTime: '06:45', endTime: '15:15' },
      { userId: 'u1', date: '2026-06-30', shiftType: 'day-off', startTime: undefined, endTime: undefined },
      { userId: 'u1', date: '2026-07-01', shiftType: 'closing', startTime: '14:30', endTime: '23:00' },
    ]);
  });

  it('skips unknown cells — never writes a guess', () => {
    const rows: ImportRow[] = [{ userId: 'u1', types: ['unknown', 'pto'] }];
    const out = buildImportShifts(rows, '2026-06-29', defaults, isFullDay);
    expect(out).toEqual([
      { userId: 'u1', date: '2026-06-30', shiftType: 'pto', startTime: undefined, endTime: undefined },
    ]);
  });

  it('keeps every assigned row', () => {
    const rows: ImportRow[] = [
      { userId: 'a', types: ['opening'] },
      { userId: 'b', types: ['closing'] },
    ];
    expect(buildImportShifts(rows, '2026-06-29', defaults, isFullDay).map((s) => s.userId)).toEqual(['a', 'b']);
  });
});

describe('nextType', () => {
  it('cycles through the six real types and wraps', () => {
    expect(nextType('opening')).toBe('mid');
    expect(nextType('closing')).toBe('day-off');
    expect(nextType('sick')).toBe('opening');
  });
  it('an unknown cell cycles into the first real type', () => {
    expect(nextType('unknown')).toBe('opening');
  });
});
