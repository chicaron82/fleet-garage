import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Profile, UserRole, BranchId } from '../types';

const ProfilesContext = createContext<Map<string, Profile>>(new Map());

/**
 * Loads every row from `profiles` (migration 054) once on mount and exposes
 * them as a `Map<id, Profile>`. This is the source of truth for resolving
 * Supabase auth UUIDs to display info — paired with `useUserResolver` and
 * the legacy USERS-mock fallback for dev/mock data keyed on mock ids.
 *
 * RLS allows any authenticated user to read all profiles (see migration 054),
 * so a single fetch at app boot is sufficient.
 */
export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('id, employee_id, name, role, branch_id')
      .then(({ data }) => {
        if (!data) return;
        const next = new Map<string, Profile>();
        for (const row of data as Record<string, unknown>[]) {
          const id = row.id as string;
          next.set(id, {
            id,
            employeeId: (row.employee_id as string),
            name:       (row.name as string),
            role:       (row.role as UserRole),
            branchId:   (row.branch_id as BranchId),
          });
        }
        setProfiles(next);
      });
  }, []);

  return (
    <ProfilesContext.Provider value={profiles}>
      {children}
    </ProfilesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfiles(): Map<string, Profile> {
  return useContext(ProfilesContext);
}
