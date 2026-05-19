// Tests for the pure user-resolver factory.
//
// The defect this replaces: hold attribution showed "Unknown" because the
// legacy USERS mock keyed on mock ids like 'u1', while real holds were
// written with Supabase auth UUIDs. See migration 057 for context.

import { describe, it, expect } from 'vitest';
import {
  createUserResolver,
  mergeTeamMembers,
  type MockFallbackUser,
} from '../../src/lib/user-resolver';
import type { Profile } from '../../src/types';

const PROFILE_REAL: Profile = {
  id:         '11111111-1111-1111-1111-111111111111',
  employeeId: 'EMP400',
  name:       'Real Person',
  role:       'VSA',
  branchId:   'YWG',
};

const MOCK_USER: MockFallbackUser = {
  id:         'u1',
  employeeId: 'EMP100',
  name:       'Mock VSA',
  role:       'VSA',
};

function makeProfiles(...profiles: Profile[]): Map<string, Profile> {
  return new Map(profiles.map(p => [p.id, p]));
}

describe('createUserResolver — profile-first', () => {
  it('returns live profile data when the id matches a profile', () => {
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), [MOCK_USER]);
    expect(resolver.getName(PROFILE_REAL.id)).toBe('Real Person');
    expect(resolver.getRole(PROFILE_REAL.id)).toBe('VSA');
    expect(resolver.getEmpId(PROFILE_REAL.id)).toBe('EMP400');
  });

  it('returns the raw profile object via getProfile', () => {
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), []);
    expect(resolver.getProfile(PROFILE_REAL.id)).toEqual(PROFILE_REAL);
  });
});

describe('createUserResolver — mock fallback', () => {
  it('falls back to the USERS mock when an id isn\'t in profiles', () => {
    const resolver = createUserResolver(new Map(), [MOCK_USER]);
    expect(resolver.getName('u1')).toBe('Mock VSA');
    expect(resolver.getEmpId('u1')).toBe('EMP100');
  });

  it('prefers profiles over the mock when both match the same id', () => {
    // Synthetic edge case — profile id collides with a mock id. The live
    // profile is authoritative.
    const collidingMock: MockFallbackUser = { ...MOCK_USER, id: PROFILE_REAL.id, name: 'Stale Mock' };
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), [collidingMock]);
    expect(resolver.getName(PROFILE_REAL.id)).toBe('Real Person');
  });
});

describe('createUserResolver — snapshot fallback', () => {
  it('uses the snapshot (denorm) name when no profile and no mock match', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getName('historical-uuid', 'Aaron S.')).toBe('Aaron S.');
  });

  it('ignores an empty-string snapshot and returns Unknown instead', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getName('historical-uuid', '')).toBe('Unknown');
  });

  it('snapshot is only consulted when profile + mock both miss', () => {
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), [MOCK_USER]);
    // Both sources match — snapshot should NOT win.
    expect(resolver.getName(PROFILE_REAL.id, 'Stale Snapshot')).toBe('Real Person');
    expect(resolver.getName('u1',           'Stale Snapshot')).toBe('Mock VSA');
  });
});

describe('createUserResolver — exhaustion', () => {
  it('returns Unknown when no source has the id', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getName('nobody')).toBe('Unknown');
  });

  it('returns empty role/empId when no source has the id', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getRole('nobody')).toBe('');
    expect(resolver.getEmpId('nobody')).toBe('');
  });

  it('returns null from getProfile when no source has the id', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getProfile('nobody')).toBeNull();
  });
});

describe('createUserResolver — getByEmployeeId', () => {
  it('finds a live profile by employee id', () => {
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), []);
    expect(resolver.getByEmployeeId('EMP400')).toEqual(PROFILE_REAL);
  });

  it('falls back to the mock when an employee id is not in profiles', () => {
    const resolver = createUserResolver(new Map(), [MOCK_USER]);
    expect(resolver.getByEmployeeId('EMP100')?.name).toBe('Mock VSA');
  });

  it('prefers profiles over the mock on employee-id collision', () => {
    const collidingMock: MockFallbackUser = { ...MOCK_USER, employeeId: 'EMP400', name: 'Stale Mock' };
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), [collidingMock]);
    expect(resolver.getByEmployeeId('EMP400')?.name).toBe('Real Person');
  });

  it('returns null when no source has the employee id', () => {
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getByEmployeeId('EMP-NOPE')).toBeNull();
  });
});

describe('mergeTeamMembers', () => {
  it('returns the union of profiles and the mock fallback', () => {
    const merged = mergeTeamMembers(makeProfiles(PROFILE_REAL), [MOCK_USER]);
    expect(merged).toHaveLength(2);
    expect(merged.map(m => m.id).sort()).toEqual([PROFILE_REAL.id, MOCK_USER.id].sort());
  });

  it('deduplicates by id, with the live profile winning', () => {
    const collidingMock: MockFallbackUser = { ...MOCK_USER, id: PROFILE_REAL.id, name: 'Stale Mock' };
    const merged = mergeTeamMembers(makeProfiles(PROFILE_REAL), [collidingMock]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Real Person');
  });

  it('returns just the mock list when no profiles are loaded', () => {
    const merged = mergeTeamMembers(new Map(), [MOCK_USER]);
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Mock VSA');
  });

  it('returns just the profiles when no mock is supplied', () => {
    const merged = mergeTeamMembers(makeProfiles(PROFILE_REAL));
    expect(merged).toEqual([PROFILE_REAL]);
  });
});

describe('createUserResolver — the migration-056 regression scenario', () => {
  it('resolves a Supabase auth UUID without needing the denorm column', () => {
    // This is the exact case that caused migration 056. With profiles loaded,
    // attribution works without any snapshot — no "Flagged by Unknown".
    const resolver = createUserResolver(makeProfiles(PROFILE_REAL), [MOCK_USER]);
    expect(resolver.getName(PROFILE_REAL.id)).toBe('Real Person');
    expect(resolver.getName(PROFILE_REAL.id)).not.toBe('Unknown');
  });

  it('still reads a historical row when profile no longer exists', () => {
    // User deleted from auth, profile gone, but the hold row remains with
    // denorm snapshot. Resolver pulls from snapshot — no data loss.
    const resolver = createUserResolver(new Map(), []);
    expect(resolver.getName('deleted-user-uuid', 'Departed Employee')).toBe('Departed Employee');
  });
});
