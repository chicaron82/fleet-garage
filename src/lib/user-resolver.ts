// User resolution — pure interface for resolving Supabase auth UUIDs to
// display info. Implemented as a stable React hook in useUserResolver.ts.
//
// Historical note: the original code used a USERS mock keyed on fake ids
// ('u1'–'u17'). All users have had real Supabase auth accounts since
// migration 057. The mock fallback was retired in migration 061.

import type { Profile, UserRole } from '../types';

export interface UserResolver {
  /** Returns a display name, or `'Unknown'` if all sources are exhausted. */
  getName:    (id: string, snapshot?: string) => string;
  /** Returns the role, or `''` if no source has one. */
  getRole:    (id: string) => UserRole | '';
  /** Returns an employee id, or `''` if no source has one. */
  getEmpId:   (id: string, snapshot?: string) => string;
  /** Raw lookup by id. `null` if the id isn't in profiles. */
  getProfile: (id: string) => Profile | null;
  /** Lookup by employee id (e.g. for audit forms keyed on EMP1234). */
  getByEmployeeId: (employeeId: string) => Profile | null;
}

/**
 * Builds a resolver over a profiles map. Pure — no React, no I/O — so it can
 * be unit-tested directly. `useUserResolver` wraps this in a `useMemo`.
 *
 * Resolution is single-tier: the `profiles` map (sourced from the `profiles`
 * table) is the only lookup source. The optional `snapshot` argument is a
 * denormalised fallback for historical rows whose author no longer has a
 * profile (e.g. deleted from auth) — it is used only when the id misses.
 */
export function createUserResolver(profiles: Map<string, Profile>): UserResolver {
  const lookup = (id: string) => profiles.get(id) ?? null;
  const lookupByEmpId = (empId: string) => {
    for (const p of profiles.values()) {
      if (p.employeeId === empId) return p;
    }
    return null;
  };
  return {
    getProfile:      lookup,
    getByEmployeeId: lookupByEmpId,
    getName:  (id, snapshot) => lookup(id)?.name       ?? (snapshot && snapshot.length > 0 ? snapshot : 'Unknown'),
    getRole:  id             => lookup(id)?.role       ?? '',
    getEmpId: (id, snapshot) => lookup(id)?.employeeId ?? (snapshot && snapshot.length > 0 ? snapshot : ''),
  };
}
