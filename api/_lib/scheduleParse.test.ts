import { describe, it, expect } from 'vitest';
import { matchStaffName, matchSchedule, type RosterProfile, type ParsedStaffRow } from './scheduleParse';

const roster: RosterProfile[] = [
  { id: 'u1', name: 'Aaron Sauddin' },
  { id: 'u2', name: 'Geoff Taylor' },
  { id: 'u3', name: 'Ray Tan' },
  { id: 'u4', name: 'Aaron Becker' }, // first-name collision with u1
];

describe('matchStaffName', () => {
  it('exact full-name match', () => {
    expect(matchStaffName('Geoff Taylor', roster)).toEqual({ profileId: 'u2', confidence: 'exact' });
    expect(matchStaffName('  geoff   taylor ', roster)).toEqual({ profileId: 'u2', confidence: 'exact' });
  });

  it('a unique first name resolves as partial', () => {
    expect(matchStaffName('Geoff', roster)).toEqual({ profileId: 'u2', confidence: 'partial' });
    expect(matchStaffName('Ray', roster)).toEqual({ profileId: 'u3', confidence: 'partial' });
  });

  it('an ambiguous first name does NOT guess (human assigns)', () => {
    expect(matchStaffName('Aaron', roster)).toEqual({ profileId: null, confidence: 'none' });
  });

  it('no match → none', () => {
    expect(matchStaffName('Marycel', roster)).toEqual({ profileId: null, confidence: 'none' });
    expect(matchStaffName('', roster)).toEqual({ profileId: null, confidence: 'none' });
  });
});

describe('matchSchedule', () => {
  it('matches each row in order', () => {
    const staff: ParsedStaffRow[] = [
      { name: 'Ray Tan', cells: [] },
      { name: 'Aaron', cells: [] },
    ];
    expect(matchSchedule(staff, roster)).toEqual([
      { profileId: 'u3', confidence: 'exact' },
      { profileId: null, confidence: 'none' },
    ]);
  });
});
