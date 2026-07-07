import { describe, it, expect } from 'vitest';
import { matchStaffName, matchSchedule, type RosterProfile, type ParsedStaffRow } from '../../../api/_lib/scheduleParse';

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

  it('duplicate EXACT names are ambiguous too (e.g. two "DiZee" bots)', () => {
    const dupes: RosterProfile[] = [{ id: 'b1', name: 'DiZee' }, { id: 'b2', name: 'DiZee' }];
    expect(matchStaffName('DiZee', dupes)).toEqual({ profileId: null, confidence: 'none' });
  });

  it('no match → none', () => {
    expect(matchStaffName('Marycel', roster)).toEqual({ profileId: null, confidence: 'none' });
    expect(matchStaffName('', roster)).toEqual({ profileId: null, confidence: 'none' });
  });

  it('strips role markers like "(PT)" before matching', () => {
    const r = [{ id: 'x', name: 'CJ' }];
    expect(matchStaffName('CJ (PT)', r)).toEqual({ profileId: 'x', confidence: 'exact' });
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

  it('resolves a bare name by elimination when its siblings are uniquely claimed', () => {
    // The real two-Larrys case: "Larry J" claims Larry J, so the bare utility "LARRY"
    // has only Larry C left → resolved (partial), no relabeling needed.
    const larrys: RosterProfile[] = [{ id: 'lc', name: 'Larry C' }, { id: 'lj', name: 'Larry J' }];
    const staff: ParsedStaffRow[] = [
      { name: 'Larry J', cells: [] },
      { name: 'LARRY', cells: [] },
    ];
    expect(matchSchedule(staff, larrys)).toEqual([
      { profileId: 'lj', confidence: 'exact' },
      { profileId: 'lc', confidence: 'partial' },
    ]);
  });

  it('does NOT eliminate while more than one candidate is still open', () => {
    // Two Aarons, neither claimed elsewhere → genuinely ambiguous, stays none (no guess).
    const staff: ParsedStaffRow[] = [{ name: 'Aaron', cells: [] }];
    expect(matchSchedule(staff, roster)).toEqual([{ profileId: null, confidence: 'none' }]);
  });

  it('order-independent: bare name first still resolves once its sibling is claimed', () => {
    const larrys: RosterProfile[] = [{ id: 'lc', name: 'Larry C' }, { id: 'lj', name: 'Larry J' }];
    const staff: ParsedStaffRow[] = [
      { name: 'LARRY', cells: [] },   // ambiguous in pass 1
      { name: 'Larry J', cells: [] }, // claims Larry J → elimination frees the bare one
    ];
    expect(matchSchedule(staff, larrys)).toEqual([
      { profileId: 'lc', confidence: 'partial' },
      { profileId: 'lj', confidence: 'exact' },
    ]);
  });
});
