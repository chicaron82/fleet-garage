import { describe, it, expect } from 'vitest';
import { upcomingPtoDates, buildPtoRequest } from './ptoRequest';
import type { ShiftWithUser } from '../types';

const shift = (over: Partial<ShiftWithUser>): ShiftWithUser =>
  ({ id: 'x', userId: 'u1', date: '2026-06-09', shiftType: 'pto', ...over } as ShiftWithUser);

describe('upcomingPtoDates', () => {
  it("returns this user's PTO days from the cutoff onward, sorted", () => {
    const shifts = [
      shift({ date: '2026-06-12' }),
      shift({ date: '2026-06-09' }),
      shift({ date: '2026-06-10', shiftType: 'sick' }),         // not pto
      shift({ date: '2026-05-01' }),                            // past
      shift({ date: '2026-06-15', userId: 'u2' }),              // other user
    ];
    expect(upcomingPtoDates(shifts, 'u1', '2026-06-01')).toEqual(['2026-06-09', '2026-06-12']);
  });

  it('is empty when there are no upcoming PTO days', () => {
    expect(upcomingPtoDates([], 'u1', '2026-06-01')).toEqual([]);
  });
});

describe('buildPtoRequest', () => {
  it('lists the requested days and the post-request balance', () => {
    const msg = buildPtoRequest('Aaron Sauddin', ['2026-06-09', '2026-06-10'], 13, 3);
    expect(msg).toContain('PTO Request — Aaron Sauddin');
    expect(msg).toContain('2 days requested.');
    expect(msg).toContain('Balance: 3 of 13 used · 10 remaining.');
    expect(msg).toContain('Please confirm approval');
    // one bullet line per requested day
    expect(msg.split('\n').filter(l => l.trim().startsWith('•')).length).toBe(2);
  });

  it('uses the singular for a single day', () => {
    expect(buildPtoRequest('A', ['2026-06-09'], 13, 1)).toContain('1 day requested.');
  });

  it('never shows a negative remaining', () => {
    expect(buildPtoRequest('A', ['2026-06-09'], 13, 20)).toContain('0 remaining.');
  });

  it('handles the empty case', () => {
    expect(buildPtoRequest('A', [], 13, 0)).toContain('No upcoming PTO days entered.');
  });
});
