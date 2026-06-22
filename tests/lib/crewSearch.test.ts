import { describe, it, expect } from 'vitest';
import { searchCrewCandidates } from '../../src/lib/crewSearch';
import type { Profile, UserRole } from '../../src/types';

let seq = 0;
const p = (name: string, role: UserRole, over: Partial<Profile> = {}): Profile => {
  seq += 1;
  return { id: `p${seq}`, name, role, employeeId: `E${seq}`, branchId: 'YWG', rosterOnly: false, ...over } as Profile;
};

const roster = (name: string): Profile => p(name, 'VSA', { employeeId: `ROSTER-${name}`, rosterOnly: true });

describe('searchCrewCandidates', () => {
  const profiles = [
    p('Aaron S.', 'VSA', { employeeId: '331965' }),
    p('Geoff N.', 'Lead VSA', { employeeId: '256163' }),
    roster('Erick'),
    p('Belle', 'VSA', { employeeId: 'VSA-003' }),   // demo persona — not real, not roster
    p('CoZee', 'CSR'),                               // counter, not floor
    p('GenZee', 'Driver'),                           // driver, not floor
  ];

  it('returns nothing for an empty query', () => {
    expect(searchCrewCandidates(profiles, '')).toEqual([]);
    expect(searchCrewCandidates(profiles, '   ')).toEqual([]);
  });

  it('matches floor staff by name substring, case-insensitively', () => {
    expect(searchCrewCandidates(profiles, 'aar').map(c => c.name)).toEqual(['Aaron S.']);
    expect(searchCrewCandidates(profiles, 'N.').map(c => c.name)).toEqual(['Geoff N.']);
  });

  it('includes roster ghosts (not real, but real crew)', () => {
    expect(searchCrewCandidates(profiles, 'erick').map(c => c.name)).toEqual(['Erick']);
  });

  it('excludes demo personas — never assign a test account to an audit', () => {
    expect(searchCrewCandidates(profiles, 'belle')).toEqual([]);
  });

  it('excludes non-floor roles (counter, drivers)', () => {
    expect(searchCrewCandidates(profiles, 'cozee')).toEqual([]);
    expect(searchCrewCandidates(profiles, 'genzee')).toEqual([]);
  });

  it('sorts by name and respects the limit', () => {
    const many = ['Zed', 'Ana', 'Mike', 'Bob', 'Cy', 'Dan', 'Eve'].map(roster);
    const out = searchCrewCandidates(many, '', 3); // empty → none regardless
    expect(out).toEqual([]);
    const hits = searchCrewCandidates([...many], 'a', 2); // Ana, Dan match 'a'; sorted, capped at 2
    expect(hits.length).toBe(2);
    expect(hits[0].name).toBe('Ana');
  });
});
