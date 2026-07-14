import { describe, it, expect } from 'vitest';
import { deriveScheduleInsights } from '../../src/lib/scheduleInsights';
import type { ShiftWithUser, ShiftType, UserRole } from '../../src/types';

// Minimal ShiftWithUser fixture — the insight logic reads only userId, shiftType, and
// user.role. `mk('me', 'opening', 'VSA')`.
const mk = (userId: string, shiftType: ShiftType, role: UserRole = 'VSA'): ShiftWithUser =>
  ({
    id: `sh_${userId}_${shiftType}`,
    userId,
    date: '2026-07-14',
    shiftType,
    startTime: '09:00',
    endTime: '17:00',
    branchId: 'YWG',
    user: { name: userId, role },
  } as unknown as ShiftWithUser);

const kinds = (shifts: ShiftWithUser[], y: ShiftType | undefined, userId = 'me') =>
  deriveScheduleInsights({ todayShifts: shifts, myYesterdayShiftType: y, userId }).map(i => i.kind);

describe('deriveScheduleInsights — clopen', () => {
  it('fires: closing yesterday → opening today, plus a coworker so solo-floor stays quiet', () => {
    // second VSA on the floor so ONLY clopen fires (isolates the clopen assertion)
    expect(kinds([mk('me', 'opening'), mk('other', 'mid')], 'closing')).toEqual(['clopen']);
  });

  it('does NOT fire when today is not an opening (mid after a closing is not a clopen)', () => {
    expect(kinds([mk('me', 'mid'), mk('other', 'opening')], 'closing')).not.toContain('clopen');
  });

  it('does NOT fire when yesterday was not a closing', () => {
    expect(kinds([mk('me', 'opening'), mk('other', 'opening')], 'mid')).not.toContain('clopen');
  });

  it('does NOT fire when there was no shift yesterday (undefined)', () => {
    expect(kinds([mk('me', 'opening'), mk('other', 'opening')], undefined)).not.toContain('clopen');
  });
});

describe('deriveScheduleInsights — solo floor', () => {
  it('fires: I am the only working VSA/Lead VSA today', () => {
    expect(kinds([mk('me', 'opening', 'VSA')], undefined)).toEqual(['solo-floor']);
  });

  it('clears when another Lead VSA is working (Lead VSA counts as floor)', () => {
    expect(kinds([mk('me', 'opening', 'VSA'), mk('lead', 'closing', 'Lead VSA')], undefined))
      .not.toContain('solo-floor');
  });

  it('still fires when the only other person on is a Driver (drivers are not floor)', () => {
    expect(kinds([mk('me', 'mid', 'VSA'), mk('drv', 'mid', 'Driver')], undefined)).toEqual(['solo-floor']);
  });

  it('still fires when another VSA is scheduled but OFF (day-off does not cover the floor)', () => {
    expect(kinds([mk('me', 'opening', 'VSA'), mk('off', 'day-off', 'VSA')], undefined)).toEqual(['solo-floor']);
  });

  it('does NOT fire when I am not floor myself (a Driver has no solo-floor concept)', () => {
    expect(kinds([mk('me', 'mid', 'Driver')], undefined)).not.toContain('solo-floor');
  });

  it('does NOT fire when I am off today, even if alone (day-off is not a solo floor)', () => {
    expect(kinds([mk('me', 'day-off', 'VSA')], undefined)).toEqual([]);
  });
});

describe('deriveScheduleInsights — clean day / no false positives', () => {
  it('returns [] when not scheduled at all today', () => {
    expect(kinds([mk('other', 'opening')], 'closing')).toEqual([]);
  });

  it('returns [] on a clean covered opening (coworker on floor, no clopen)', () => {
    expect(kinds([mk('me', 'opening', 'VSA'), mk('other', 'mid', 'VSA')], 'mid')).toEqual([]);
  });

  it('surfaces BOTH when a solo opener also just closed (clopen first, then solo-floor)', () => {
    expect(kinds([mk('me', 'opening', 'VSA')], 'closing')).toEqual(['clopen', 'solo-floor']);
  });
});
