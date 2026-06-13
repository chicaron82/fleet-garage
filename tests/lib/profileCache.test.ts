import { describe, it, expect, beforeEach } from 'vitest';
import { cacheProfile, getCachedProfile, clearProfileCache, restoreOnNullProfile } from '../../src/lib/profileCache';
import type { User } from '../../src/types';

const USER: User = {
  id: 'u-1', employeeId: 'E001', name: 'Test VSA', role: 'VSA', branchId: 'YWG',
};

beforeEach(() => {
  localStorage.clear();
});

describe('profileCache — store / retrieve', () => {
  it('round-trips a cached profile by user id', () => {
    cacheProfile(USER);
    expect(getCachedProfile('u-1')).toEqual(USER);
  });

  it('returns null for an uncached user', () => {
    expect(getCachedProfile('nobody')).toBeNull();
  });

  it('identity guard: never returns a profile whose id ≠ the requested id', () => {
    // Hand-write a record under one key carrying a different id inside.
    localStorage.setItem('fg_profile_u-1', JSON.stringify({ ...USER, id: 'someone-else' }));
    expect(getCachedProfile('u-1')).toBeNull();
  });

  it('corrupt JSON is safe — returns null, never throws', () => {
    localStorage.setItem('fg_profile_u-1', '{not json');
    expect(getCachedProfile('u-1')).toBeNull();
  });

  it('clear removes every cached profile', () => {
    cacheProfile(USER);
    cacheProfile({ ...USER, id: 'u-2' });
    clearProfileCache();
    expect(getCachedProfile('u-1')).toBeNull();
    expect(getCachedProfile('u-2')).toBeNull();
  });
});

// The security gate: a cached profile may only be ridden when GENUINELY OFFLINE
// on an initial session. An online null means the server has no profile for this
// user (deactivated/deleted) → must require login, never ride a stale cache.
describe('restoreOnNullProfile — the offline-only gate', () => {
  it('offline + INITIAL_SESSION → rides the cached profile', () => {
    expect(restoreOnNullProfile('INITIAL_SESSION', false, USER)).toEqual(USER);
  });

  it('ONLINE + INITIAL_SESSION → null even with a cache (deactivated user must not get in)', () => {
    expect(restoreOnNullProfile('INITIAL_SESSION', true, USER)).toBeNull();
  });

  it('offline but not an initial session → null (only the reload-restore path rides it)', () => {
    expect(restoreOnNullProfile('SIGNED_IN', false, USER)).toBeNull();
    expect(restoreOnNullProfile('TOKEN_REFRESHED', false, USER)).toBeNull();
  });

  it('offline + INITIAL_SESSION but no cache → null (nothing to restore)', () => {
    expect(restoreOnNullProfile('INITIAL_SESSION', false, null)).toBeNull();
  });
});
