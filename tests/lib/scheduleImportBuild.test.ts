import { describe, it, expect } from 'vitest';
import { addDaysISO, buildImportShifts, nextType, dateRange, dropProtectedDays, PROTECTED_IMPORT_TYPES, type ImportRow } from '../../src/lib/scheduleImportBuild';
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

// ── Protected days (2026-07-20) ─────────────────────────────────────────────────
// A printed sheet routinely omits approved time off — Aaron's boss forgetting to mark his
// PTO is the recurring case. The import used to trust the sheet and delete the booking; his
// Aug 7 + Aug 10 vanished and only came back because he noticed.
describe('dropProtectedDays', () => {
  const preserved = [
    { userId: 'aaron', date: '2026-08-07', shiftType: 'pto' as const },
    { userId: 'aaron', date: '2026-08-10', shiftType: 'pto' as const },
  ];

  it('drops a sheet shift that would overwrite a preserved day', () => {
    const incoming = [
      { userId: 'aaron', date: '2026-08-07', shiftType: 'opening' as const }, // boss forgot the PTO
      { userId: 'aaron', date: '2026-08-08', shiftType: 'mid' as const },
    ];
    expect(dropProtectedDays(incoming, preserved)).toEqual([
      { userId: 'aaron', date: '2026-08-08', shiftType: 'mid' as const },
    ]);
  });

  it('never double-books a preserved date (the duplicate-PTO trap)', () => {
    // If the sheet DOES show the PTO, inserting it alongside the kept row would create two
    // rows for one day — and count it twice in the PTO tally.
    const incoming = [{ userId: 'aaron', date: '2026-08-07', shiftType: 'pto' as const }];
    expect(dropProtectedDays(incoming, preserved)).toEqual([]);
  });

  it('only protects the OWNER of the booking, not the same date for everyone', () => {
    const incoming = [{ userId: 'geoff', date: '2026-08-07', shiftType: 'opening' as const }];
    expect(dropProtectedDays(incoming, preserved)).toEqual(incoming);
  });

  it('is a no-op when nothing was preserved', () => {
    const incoming = [{ userId: 'aaron', date: '2026-08-07', shiftType: 'opening' as const }];
    expect(dropProtectedDays(incoming, [])).toEqual(incoming);
  });

  it('protects sick days as well as pto', () => {
    expect(PROTECTED_IMPORT_TYPES).toContain('pto');
    expect(PROTECTED_IMPORT_TYPES).toContain('sick');
  });
});
