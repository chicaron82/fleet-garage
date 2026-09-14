import { describe, it, expect } from 'vitest';
import {
  isoWeekday, isWorkingType, isWorkDayConflict, describeWorkDays, describeConflict, findWorkDayConflicts,
  findImportWorkDayConflicts,
} from '../../src/lib/workDays';

// Aaron, 2026-09-14: "Grant can only work Tues and Thurs. if scheduled any other day, its an error."
const TUE_THU = [2, 4];

describe('isoWeekday', () => {
  it('numbers Monday 1 through Sunday 7 — the column\'s numbering', () => {
    expect(isoWeekday('2026-09-14')).toBe(1); // Mon
    expect(isoWeekday('2026-09-15')).toBe(2); // Tue
    expect(isoWeekday('2026-09-20')).toBe(7); // Sun — not 0
  });
});

describe('isWorkDayConflict', () => {
  it('⭐ a working shift on a day outside the rule is a conflict', () => {
    expect(isWorkDayConflict(TUE_THU, '2026-09-16', 'opening')).toBe(true); // Wed
  });

  it('a working shift on an allowed day is fine', () => {
    expect(isWorkDayConflict(TUE_THU, '2026-09-15', 'closing')).toBe(false);
  });

  it('⚠️ PTO, sick and day-off never conflict — Grant\'s own week is VAC on his days', () => {
    for (const t of ['pto', 'sick', 'day-off']) {
      expect(isWorkDayConflict(TUE_THU, '2026-09-16', t)).toBe(false);
    }
  });

  it('null or empty work days means any day', () => {
    expect(isWorkDayConflict(null, '2026-09-16', 'mid')).toBe(false);
    expect(isWorkDayConflict([], '2026-09-16', 'mid')).toBe(false);
  });

  it('knows the working types', () => {
    expect(['opening', 'mid', 'closing'].every(isWorkingType)).toBe(true);
  });
});

describe('describeWorkDays', () => {
  it('reads in week order whatever order the column holds', () => {
    expect(describeWorkDays([4, 2])).toBe('Tue and Thu');
    expect(describeWorkDays([5, 1, 3])).toBe('Mon, Wed and Fri');
    expect(describeWorkDays([6])).toBe('Sat');
  });
});

describe('findWorkDayConflicts', () => {
  const people = new Map([
    ['grant', { name: 'Grant', workDays: TUE_THU }],
    ['donna', { name: 'Donna', workDays: null }],
  ]);

  it('⭐ names each conflicting shift, in date order', () => {
    const shifts = [
      { userId: 'grant', date: '2026-09-18', shiftType: 'closing' },
      { userId: 'grant', date: '2026-09-15', shiftType: 'pto' },
      { userId: 'grant', date: '2026-09-16', shiftType: 'opening' },
      { userId: 'donna', date: '2026-09-16', shiftType: 'opening' },
    ];
    const got = findWorkDayConflicts(shifts, people, '2026-09-14');
    expect(got.map(c => c.date)).toEqual(['2026-09-16', '2026-09-18']);
    expect(describeConflict(got[0])).toBe('Grant — Wed, Sep 16 · works Tue and Thu only');
  });

  it('⚠️ ignores the past — a shift that is over cannot be fixed', () => {
    const shifts = [{ userId: 'grant', date: '2026-09-09', shiftType: 'opening' }];
    expect(findWorkDayConflicts(shifts, people, '2026-09-14')).toEqual([]);
  });

  it('ignores a shift whose person FG does not know', () => {
    expect(findWorkDayConflicts([{ userId: 'ghost', date: '2026-09-16', shiftType: 'mid' }], people, '2026-09-14')).toEqual([]);
  });
});

describe('findImportWorkDayConflicts — the photo import preview', () => {
  const people = new Map([['grant', { name: 'Grant', workDays: TUE_THU }]]);
  const rows = [{ cells: [{ date: '2026-09-15' }, { date: '2026-09-16' }, { date: null }] }];

  it('⭐ marks the exact cell and names it, using the EFFECTIVE type of each cell', () => {
    const { cells, conflicts } = findImportWorkDayConflicts(rows, ['grant'], [['pto', 'mid', 'mid']], people);
    expect([...cells]).toEqual(['0-1']);
    expect(conflicts.map(c => c.date)).toEqual(['2026-09-16']);
  });

  it('clears when he taps the cell to Off', () => {
    expect(findImportWorkDayConflicts(rows, ['grant'], [['pto', 'day-off', 'mid']], people).cells.size).toBe(0);
  });

  it('an unassigned row cannot conflict — nobody is known yet', () => {
    expect(findImportWorkDayConflicts(rows, [null], [['mid', 'mid', 'mid']], people).conflicts).toEqual([]);
  });
});
