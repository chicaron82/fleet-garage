import { describe, it, expect } from 'vitest';
import {
  greeting, carsCleaned, teammatesOnToday, deriveMyDay, nextAttendance,
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

// fmtTime24 / shiftTimeRange moved to lib/shiftTypeMeta — tested in shiftTypeMeta.test.ts.

describe('carsCleaned', () => {
  it('is full pages of 19 plus the last-page entries', () => {
    expect(carsCleaned({ fullPages: 2, lastPageEntries: 5 })).toBe(43);
    expect(carsCleaned({ fullPages: 0, lastPageEntries: 0 })).toBe(0);
  });
});

describe('nextAttendance (pill tap cycle)', () => {
  it('cycles scheduled → present → absent → scheduled', () => {
    expect(nextAttendance(undefined)).toBe('present');
    expect(nextAttendance('present')).toBe('absent');
    expect(nextAttendance('absent')).toBeUndefined();
  });
});

describe('teammatesOnToday', () => {
  const today = '2026-07-01';
  const shifts: ShiftWithUser[] = [
    shift({ userId: 'me', date: today, shiftType: 'opening', name: 'Aaron S' }),
    shift({ userId: 'u2', date: today, shiftType: 'closing', startTime: '16:00:00', name: 'CJ Rivera' }),
    shift({ userId: 'u3', date: today, shiftType: 'opening', startTime: '06:45:00', endTime: '15:15:00', name: 'Ray Diaz' }),
    shift({ userId: 'u4', date: today, shiftType: 'day-off', name: 'Off Person' }),
    shift({ userId: 'u5', date: '2026-07-02', shiftType: 'opening', name: 'Tomorrow' }),
  ];

  it('excludes me, day-offs, and other days; sorts by start; maps first name + HH:MM', () => {
    const team = teammatesOnToday(shifts, 'me', today);
    expect(team.map(t => t.displayName)).toEqual(['Ray', 'CJ']); // 06:45 before 16:00
    expect(team[0].start).toBe('06:45');
    expect(team[0].end).toBe('15:15'); // marking a mate present flips the pill to show this ("til 15:15")
    expect(team.find(t => t.displayName === 'Off')).toBeUndefined();
    expect(team.find(t => t.displayName === 'Tomorrow')).toBeUndefined();
  });

  it('disambiguates same-first-name teammates to full roster names (utility Larry C vs driver Larry J)', () => {
    const larrys: ShiftWithUser[] = [
      shift({ userId: 'me', date: today, shiftType: 'mid', name: 'Aaron S' }),
      shift({ userId: 'lc', date: today, shiftType: 'opening', startTime: '08:00:00', name: 'Larry C' }),
      shift({ userId: 'lj', date: today, shiftType: 'opening', startTime: '10:00:00', name: 'Larry J' }),
      shift({ userId: 'rob', date: today, shiftType: 'closing', startTime: '16:00:00', name: 'Robert' }),
    ];
    // Both Larrys → full names; the un-collided Robert stays first-name.
    expect(teammatesOnToday(larrys, 'me', today).map(t => t.displayName)).toEqual(['Larry C', 'Larry J', 'Robert']);
  });

  it('carries each mate\'s attendance through (undefined when unmarked)', () => {
    const withAtt: ShiftWithUser[] = [
      shift({ userId: 'me', date: today, shiftType: 'opening', name: 'Aaron S' }),
      shift({ userId: 'u2', date: today, shiftType: 'opening', startTime: '07:00:00', name: 'Ray Diaz', attendance: 'present' }),
      shift({ userId: 'u3', date: today, shiftType: 'closing', startTime: '16:00:00', name: 'CJ Rivera' }),
    ];
    const team = teammatesOnToday(withAtt, 'me', today);
    expect(team.find(t => t.displayName === 'Ray')?.attendance).toBe('present');
    expect(team.find(t => t.displayName === 'CJ')?.attendance).toBeUndefined();
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
    expect(m.team.map(t => t.displayName)).toEqual(['CJ']);
  });

  it('day-off → working false (no fleet-balance prompt on a day off)', () => {
    const shifts = [shift({ userId: 'me', date: today, shiftType: 'day-off', name: 'Aaron S' })];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(false);
    expect(m.overtime).toBe(false);          // no hours logged → nothing to prove he is here
    expect(m.shiftLabel).toBe('Day Off');
    expect(m.shiftSubLabel).toBeNull();
    expect(m.shiftTime).toBeNull();
  });

  // ── Called in on a day off ───────────────────────────────────────────────────────────────────
  // Aaron worked OT on a rostered day off (2026-08-22) and My Day rendered an empty cockpit while
  // he was standing in the bay — because `working` read the roster type and never the clock, even
  // though ot.ts had been pricing the same day at 1.5x all morning.

  it('⭐ day-off WITH actual hours → working, and the headline says Overtime', () => {
    const shifts = [shift({
      userId: 'me', date: today, shiftType: 'day-off', name: 'Aaron S',
      actualStartTime: '10:01', actualEndTime: '15:00',
    })];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(true);
    expect(m.overtime).toBe(true);
    expect(m.shiftLabel).toBe('Overtime');
    // The day-off is WHY every hour is 1.5x, so the label must not erase it.
    expect(m.shiftSubLabel).toBe('Scheduled day off');
    // A full-day type has no scheduled times — the range comes from the hours actually logged.
    expect(m.shiftTime).toBe('10:01 – 15:00');
  });

  it('a clock-in with no clock-out still counts as working', () => {
    // Mid-shift is the normal case: he punched in, the end time is not known yet.
    const shifts = [shift({
      userId: 'me', date: today, shiftType: 'day-off', name: 'Aaron S', actualStartTime: '10:01',
    })];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(true);
    expect(m.overtime).toBe(true);
  });

  it('pto and sick behave the same when hours get logged', () => {
    for (const type of ['pto', 'sick'] as const) {
      const shifts = [shift({ userId: 'me', date: today, shiftType: type, name: 'Aaron S', actualStartTime: '08:00' })];
      expect(deriveMyDay({ ...base, shifts }).overtime).toBe(true);
    }
  });

  it('a ROSTERED shift is never labelled overtime, however its hours run', () => {
    // The direction matters: logged hours only ever ADD the working state. A normal shift with
    // actual hours is just a normal shift — overtime here would be a lie on every ordinary day.
    const shifts = [shift({
      userId: 'me', date: today, shiftType: 'opening', name: 'Aaron S',
      actualStartTime: '06:45', actualEndTime: '17:30',
    })];
    const m = deriveMyDay({ ...base, shifts });
    expect(m.working).toBe(true);
    expect(m.overtime).toBe(false);
    expect(m.shiftLabel).toBe('Opening');
    expect(m.shiftSubLabel).toBeNull();
    expect(m.shiftTime).toBe('09:00 – 17:00');
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
