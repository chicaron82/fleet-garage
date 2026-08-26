import { describe, it, expect } from 'vitest';
import { roleGroup, standingAt, groupRoster, hhmm } from '../../src/lib/rosterGrouping';
import type { TeamMate } from '../../src/lib/myDay';
import type { UserRole } from '../../src/types';

const mate = (displayName: string, start: string, end: string, role: UserRole = 'VSA'): TeamMate =>
  ({ id: displayName, displayName, start, end, role });

describe('roleGroup', () => {
  it('puts a Lead VSA with the VSAs — he works the same floor', () => {
    expect(roleGroup('VSA')).toBe('vsa');
    expect(roleGroup('Lead VSA')).toBe('vsa');
  });
  it('separates drivers, and buckets everyone else as other', () => {
    expect(roleGroup('Driver')).toBe('driver');
    expect(roleGroup('CSR')).toBe('other');
    expect(roleGroup('GM')).toBe('other');
  });
});

describe('standingAt', () => {
  it('reads a normal shift against the clock', () => {
    const m = mate('Geoff', '06:45', '15:15');
    expect(standingAt(m, '06:00')).toBe('later');
    expect(standingAt(m, '10:00')).toBe('now');
    expect(standingAt(m, '15:15')).toBe('done');   // the end is exclusive — at 15:15 he's out
    expect(standingAt(m, '18:26')).toBe('done');
  });

  // ⚠️ THE CASE A NAIVE `now >= end` GETS WRONG. A closer running past midnight has end < start,
  // and string-comparing it would mark a 22:00–00:30 shift "done" from the moment it began.
  it('a shift crossing midnight is still ON, not done', () => {
    const closer = mate('Ray', '14:30', '00:30');
    expect(standingAt(closer, '15:00')).toBe('now');
    expect(standingAt(closer, '23:59')).toBe('now');
    expect(standingAt(closer, '00:15')).toBe('now');
    expect(standingAt(closer, '01:00')).toBe('later');
    expect(standingAt(closer, '12:00')).toBe('later');
  });

  it('an unknown span is not evidence they have gone', () => {
    expect(standingAt(mate('Rohan', '', ''), '23:00')).toBe('now');
  });
});

describe('groupRoster', () => {
  const team = [
    mate('Geoff', '06:45', '15:15'),
    mate('Krish', '11:30', '20:00'),
    mate('Ray', '14:30', '23:00', 'Driver'),
    mate('Larry C', '08:00', '16:30', 'Driver'),
    mate('Val', '09:00', '17:00', 'CSR'),
  ];

  // ⭐⭐⭐ THE CONTRACT THE WHOLE MODULE EXISTS TO KEEP. Aaron asked for ended teammates to
  // DISAPPEAR; they must not, because the pill is the only way to mark an attendance he forgot.
  // A test asserting "sorted correctly" would pass on an implementation that filtered them out.
  it('keeps ended teammates in the list — they are ordered last, never removed', () => {
    const sections = groupRoster(team, '18:26');
    const names = sections.flatMap(s => s.mates.map(m => m.mate.displayName));
    expect(names).toContain('Geoff');          // ended 15:15
    expect(names).toContain('Larry C');        // ended 16:30
    expect(names.length).toBe(team.length);    // nobody dropped, at any hour
  });

  it('orders on-now before later before done, within a group', () => {
    // 10:00 — Geoff is on, Krish hasn't started.
    const vsa = groupRoster(team, '10:00').find(s => s.group === 'vsa')!;
    expect(vsa.mates.map(m => m.mate.displayName)).toEqual(['Geoff', 'Krish']);
    // 16:00 — Geoff is done, Krish is on. The order flips.
    const later = groupRoster(team, '16:00').find(s => s.group === 'vsa')!;
    expect(later.mates.map(m => m.mate.displayName)).toEqual(['Krish', 'Geoff']);
  });

  it('counts who is actually on the floor per group', () => {
    const at1000 = groupRoster(team, '10:00');
    expect(at1000.find(s => s.group === 'vsa')!.onNow).toBe(1);      // Geoff
    expect(at1000.find(s => s.group === 'driver')!.onNow).toBe(1);   // Larry C
    const at2100 = groupRoster(team, '21:00');
    expect(at2100.find(s => s.group === 'vsa')!.onNow).toBe(0);      // all VSAs gone
    expect(at2100.find(s => s.group === 'driver')!.onNow).toBe(1);   // Ray til 23:00
  });

  it('holds a fixed group order so the list does not reshuffle under his thumb', () => {
    expect(groupRoster(team, '10:00').map(s => s.group)).toEqual(['vsa', 'driver', 'other']);
    expect(groupRoster(team, '22:00').map(s => s.group)).toEqual(['vsa', 'driver', 'other']);
  });

  it('drops empty groups rather than rendering a header with nothing under it', () => {
    const vsaOnly = [mate('Geoff', '06:45', '15:15')];
    expect(groupRoster(vsaOnly, '10:00').map(s => s.group)).toEqual(['vsa']);
  });

  it('is empty for an empty roster', () => {
    expect(groupRoster([], '10:00')).toEqual([]);
  });
});

describe('hhmm', () => {
  it('zero-pads so string comparison stays valid', () => {
    expect(hhmm(new Date(2026, 7, 26, 6, 5))).toBe('06:05');
    expect(hhmm(new Date(2026, 7, 26, 18, 26))).toBe('18:26');
  });
});
