import { describe, it, expect } from 'vitest';
import { addDaysISO, buildImportShifts, nextType, dateRange, type ImportRow } from '../../src/lib/scheduleImportBuild';
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
  it('writes each cell at its REAL date with its REAL times; full-day types carry none', () => {
    const rows: ImportRow[] = [
      {
        userId: 'u1',
        cells: [
          { date: '2026-04-17', type: 'opening', startTime: '06:45', endTime: '15:15' },
          { date: '2026-04-18', type: 'day-off', startTime: null, endTime: null },
          { date: '2026-04-19', type: 'pto', startTime: null, endTime: null },
        ],
      },
    ];
    expect(buildImportShifts(rows, defaults, isFullDay)).toEqual([
      { userId: 'u1', date: '2026-04-17', shiftType: 'opening', startTime: '06:45', endTime: '15:15' },
      { userId: 'u1', date: '2026-04-18', shiftType: 'day-off', startTime: undefined, endTime: undefined },
      { userId: 'u1', date: '2026-04-19', shiftType: 'pto', startTime: undefined, endTime: undefined },
    ]);
  });

  it('falls back to default times when a working cell has none (off flipped to working)', () => {
    const rows: ImportRow[] = [{ userId: 'u1', cells: [{ date: '2026-04-17', type: 'closing', startTime: null, endTime: null }] }];
    expect(buildImportShifts(rows, defaults, isFullDay)[0]).toEqual({
      userId: 'u1', date: '2026-04-17', shiftType: 'closing', startTime: '14:30', endTime: '23:00',
    });
  });

  it('skips cells with no date or an unknown type', () => {
    const rows: ImportRow[] = [
      {
        userId: 'u1',
        cells: [
          { date: null, type: 'opening', startTime: '06:45', endTime: '15:15' },
          { date: '2026-04-17', type: 'unknown', startTime: null, endTime: null },
          { date: '2026-04-18', type: 'mid', startTime: '10:00', endTime: '18:00' },
        ],
      },
    ];
    expect(buildImportShifts(rows, defaults, isFullDay)).toEqual([
      { userId: 'u1', date: '2026-04-18', shiftType: 'mid', startTime: '10:00', endTime: '18:00' },
    ]);
  });
});

describe('dateRange', () => {
  it('returns the min/max date across shifts (the wipe window)', () => {
    expect(dateRange([{ date: '2026-05-14' }, { date: '2026-04-17' }, { date: '2026-04-30' }])).toEqual({
      start: '2026-04-17',
      end: '2026-05-14',
    });
  });
  it('null for empty', () => {
    expect(dateRange([])).toBeNull();
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
