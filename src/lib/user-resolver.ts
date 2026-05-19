// User resolution — replaces the historical USERS-mock lookup for
// auth-driven id → display info.
//
// Background: the original code resolved hold attribution via the USERS mock
// (mock ids like 'u1'). Real Supabase auth UUIDs never matched, so every
// production hold showed "Flagged by Unknown" — see migration 056 for the
// denormalization workaround, and migration 057 for its retirement.
//
// This module is the proper fix: a pure resolver factory that prefers live
// profile data, then falls back to the legacy USERS mock (for dev/mock data
// keyed on mock ids), and finally to caller-supplied snapshot data (the
// denorm columns) for historical rows whose profile no longer exists.

import type { Profile, UserRole } from '../types';

export interface UserResolver {
  /** Returns a display name, or `'Unknown'` if all sources are exhausted. */
  getName:    (id: string, snapshot?: string) => string;
  /** Returns the role, or `''` if no source has one. */
  getRole:    (id: string) => UserRole | '';
  /** Returns an employee id, or `''` if no source has one. */
  getEmpId:   (id: string, snapshot?: string) => string;
  /** Raw lookup by id. `null` if the id isn't in profiles or the mock fallback. */
  getProfile: (id: string) => Profile | null;
  /** Lookup by employee id (e.g. for audit forms keyed on EMP1234). */
  getByEmployeeId: (employeeId: string) => Profile | null;
}

export interface MockFallbackUser {
  id:         string;
  name:       string;
  role:       UserRole;
  employeeId: string;
  branchId?:  Profile['branchId'];
}

export function createUserResolver(
  profiles: Map<string, Profile>,
  fallback: readonly MockFallbackUser[] = [],
): UserResolver {
  const lookup = (id: string): Profile | null => {
    const live = profiles.get(id);
    if (live) return live;
    const mock = fallback.find(u => u.id === id);
    if (mock) {
      return {
        id:         mock.id,
        employeeId: mock.employeeId,
        name:       mock.name,
        role:       mock.role,
        branchId:   mock.branchId ?? 'YWG',
      };
    }
    return null;
  };

  const lookupByEmployeeId = (employeeId: string): Profile | null => {
    for (const p of profiles.values()) {
      if (p.employeeId === employeeId) return p;
    }
    const mock = fallback.find(u => u.employeeId === employeeId);
    if (mock) {
      return {
        id:         mock.id,
        employeeId: mock.employeeId,
        name:       mock.name,
        role:       mock.role,
        branchId:   mock.branchId ?? 'YWG',
      };
    }
    return null;
  };

  return {
    getProfile:      lookup,
    getByEmployeeId: lookupByEmployeeId,
    getName:  (id, snapshot) => lookup(id)?.name       ?? (snapshot && snapshot.length > 0 ? snapshot : 'Unknown'),
    getRole:  id             => lookup(id)?.role       ?? '',
    getEmpId: (id, snapshot) => lookup(id)?.employeeId ?? (snapshot && snapshot.length > 0 ? snapshot : ''),
  };
}

/**
 * Merge live profiles with the mock fallback into a single deduped list.
 * Live profiles win on id collision. Useful for "team members" UI that needs
 * to iterate or filter rather than do point lookups.
 */
export function mergeTeamMembers(
  profiles: Map<string, Profile>,
  fallback: readonly MockFallbackUser[] = [],
): Profile[] {
  const out: Profile[] = Array.from(profiles.values());
  const seenIds = new Set(out.map(p => p.id));
  for (const m of fallback) {
    if (seenIds.has(m.id)) continue;
    out.push({
      id:         m.id,
      employeeId: m.employeeId,
      name:       m.name,
      role:       m.role,
      branchId:   m.branchId ?? 'YWG',
    });
  }
  return out;
}
