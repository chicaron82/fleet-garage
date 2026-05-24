import { useMemo, useRef } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import { USERS } from '../data/mock';
import type { UserResolver, MockFallbackUser } from '../lib/user-resolver';
import type { Profile } from '../types';

/**
 * React adapter that returns a stable UserResolver whose functions read from
 * a ref at call time. ProfilesContext starts as an empty Map and replaces it
 * once the async fetch resolves — without the ref, that single Map swap
 * cascades through useMemo/useCallback chains and re-fires effects downstream
 * (e.g. ScheduleContext's auto-load). With a ref the returned object never
 * changes reference, so none of those deps are disturbed.
 *
 * The lookup logic mirrors createUserResolver exactly — kept inline here so
 * the pure factory and its tests stay untouched.
 *
 * Future cleanup: once schedule/audit code paths are on real auth UUIDs the
 * USERS fallback can be dropped entirely.
 */
export function useUserResolver(): UserResolver {
  const profiles = useProfiles();
  const profilesRef = useRef<Map<string, Profile>>(profiles);
  profilesRef.current = profiles;

  return useMemo((): UserResolver => {
    const lookup = (id: string): Profile | null => {
      const live = profilesRef.current.get(id);
      if (live) return live;
      const mock = (USERS as MockFallbackUser[]).find(u => u.id === id);
      if (!mock) return null;
      return { id: mock.id, employeeId: mock.employeeId, name: mock.name, role: mock.role, branchId: mock.branchId ?? 'YWG' };
    };
    const lookupByEmpId = (empId: string): Profile | null => {
      for (const p of profilesRef.current.values()) {
        if (p.employeeId === empId) return p;
      }
      const mock = (USERS as MockFallbackUser[]).find(u => u.employeeId === empId);
      if (!mock) return null;
      return { id: mock.id, employeeId: mock.employeeId, name: mock.name, role: mock.role, branchId: mock.branchId ?? 'YWG' };
    };
    return {
      getProfile:      lookup,
      getByEmployeeId: lookupByEmpId,
      getName:  (id, snapshot) => lookup(id)?.name       ?? (snapshot && snapshot.length > 0 ? snapshot : 'Unknown'),
      getRole:  id             => lookup(id)?.role       ?? '',
      getEmpId: (id, snapshot) => lookup(id)?.employeeId ?? (snapshot && snapshot.length > 0 ? snapshot : ''),
    };
  }, []); // stable — functions read from profilesRef.current at call time
}
