import { describe, it, expect } from 'vitest';
import {
  greeting, fmtTime, shiftTimeRange, carsCleaned, teammatesOnToday, deriveMyDay,
} from '../../src/lib/myDay';
import type { ShiftWithUser, ShiftType } from '../../src/types';

function shift(over: Partial<ShiftWithUser> & { userId: string; date: string; shiftType: ShiftType; name?: string }): ShiftWithUser {
  const { name, ...rest } = over;
  const fullDay = rest.shiftType === 'day-off' || rest.shiftType === 'pto' || rest.shiftType === 'sick';
  return {
    id: `${rest.userId}-${rest.date}`,
    startTime: fullDay ? undefined : '09:00',
    endTime: fullDay ? undefined : '17:00',
    notes: undefined,
    createdAt: '', updatedAt: '', branchId: 'YWG',
    user: { name: name ?? 'Test User', role: 'VSA' },
    ...rest,
  } as ShiftWithUser;
}

describe('greeting', () => {
  it('splits morning / afternoon / evening at 12 and 17', () => {
    expect(greeting(0)).toBe('Good morning');
    expect(greeting(11)).toBe('Good morning');
    expect(greeting(12)).toBe('Good afternoon');
    expect(greeting(16)).toBe('Good afternoon');
    expect(greeting(17)).toBe('Good evening');
    expect(greeting(23)).toBe('Good evening');
  });
});

describe('fmtTime', () => {
  it('trims HH:MM:SS to HH:MM and handles undefined', () => {
    expect(fmtTime('06:45:00')).toBe('06:45');
    expect(fmtTime('06:45')).toBe('06:45');
    expect(fmtTime(undefined)).toBe('');
  });
});

describe('shiftTimeRange', () => {
  it('formats a range, null when either end is missing', () => {
    expect(shiftTimeRange('06:45:00', '15:30:00')).toBe('06:45 – 15:30');
    expect(shiftTimeRange(undefined, '15:30')).toBeNull();
    expect(shiftTimeRange('06:45', undefined)).toBeNull();
  });
});

describe('carsCleaned', () => {
  it('is full pages of 19 plus the last-page entries', () => {
    expect(carsCleaned({ fullPages: 2, lastPageEntries: 5 })).toBe(43);
    expect(carsCleaned({ fullPages: 0, lastPageEntries: 0 })).toBe(0);
  });
});

describe('teammatesOnToday', () => {
  const today = '2026-07-01';
  const shifts: ShiftWithUser[] = [
    shift({ userId: 'me', date: today, shiftType: 'opening', name: 'Aaron S' }),
    shift({ userId: 'u2', date: today, shiftType: 'closing', startTime: '16:00:00', name: 'CJ Rivera' }),
    shift({ userId: 'u3', date: today, shiftType: 'opening', startTime: '06:45:00', name: 'Ray Diaz' }),
    shift({ userId: 'u4', date: today, shiftType: 'day-off', name: 'Off Person' }),
    shift({ userId: 'u5', date: '2026-07-02', shiftType: 'opening', name: 'Tomorrow' }),
  ];

  it('excludes me, day-offs, and other days; sorts by start; maps first name + HH:MM', () => {
    const team = teammatesOnToday(shifts, 'me', today);
    expect(team.map(t => t.firstName)).toEqual(['Ray', 'CJ']); // 06:45 before 16:00
    expect(team[0].start).toBe('06:45');
    expect(team.find(t => t.firstName === 'Off')).toBeUndefined();
    expect(team.find(t => t.firstName === 'Tomorrow')).toBeUndefined();
  });
});

describe('deriveMyDay', () => {
  const today = '2026-07-01';
  const base = { userId: 'me', userName: 'Aaron Sauddin', todayISO: today, hour: 9, handoffIsToday: false };

  it('working shift → working true, labels + team populated', () => {
    const shifts = [
      shift({ userId: 'me', date: today, shiftType: 'opening', startTime: '06:45:00', endTime: '15:30:00', name: 'Aaron S' }),
      shift({ userId: 'u2', date: today, shiftType: 'closing', startTime: '16:00:00', name: 'CJ R' }),
    ];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(true);
    expect(m.isMid).toBe(false);
    expect(m.shiftLabel).toBe('Opening');
    expect(m.shiftTime).toBe('06:45 – 15:30');
    expect(m.firstName).toBe('Aaron');
    expect(m.greeting).toBe('Good morning');
    expect(m.team.map(t => t.firstName)).toEqual(['CJ']);
  });

  it('day-off → working false (no fleet-balance prompt on a day off)', () => {
    const shifts = [shift({ userId: 'me', date: today, shiftType: 'day-off', name: 'Aaron S' })];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(false);
    expect(m.shiftLabel).toBe('Day off');
    expect(m.shiftTime).toBeNull();
  });

  it('not scheduled → working false, myShift undefined', () => {
    const m = deriveMyDay({ ...base, shifts: [] });
    expect(m.myShift).toBeUndefined();
    expect(m.working).toBe(false);
    expect(m.shiftLabel).toBeNull();
  });

  it('carsCleanedThisShift only counts a handoff logged today', () => {
    const shifts = [shift({ userId: 'me', date: today, shiftType: 'mid', name: 'Aaron S' })];
    const handoff = { fullPages: 3, lastPageEntries: 2 } as never;
    expect(deriveMyDay({ ...base, shifts, handoff, handoffIsToday: true }).carsCleanedThisShift).toBe(59);
    expect(deriveMyDay({ ...base, shifts, handoff, handoffIsToday: false }).carsCleanedThisShift).toBeNull();
    expect(deriveMyDay({ ...base, shifts }).isMid).toBe(true);
  });
});
