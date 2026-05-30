import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Profile, UserRole, BranchId } from '../types';

const ProfilesContext = createContext<Map<string, Profile>>(new Map());

/**
 * Loads every row from `profiles` (migration 054) and exposes them as a
 * `Map<id, Profile>` — the source of truth for resolving Supabase auth UUIDs
 * to display info, consumed by `useUserResolver`.
 *
 * RLS allows any *authenticated* user to read all profiles (see migration 054).
 * The fetch is therefore gated on `useAuth().user`: firing on bare mount races
 * the auth session, so on a cold load the query would return no rows (no JWT
 * yet) and silently leave the map empty — surfacing as "Flagged by Unknown"
 * until a manual refresh warmed the session. Keying the effect on `user` runs
 * it once the session resolves, and refetches if the signed-in user changes.
 */
export function ProfilesProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());

  useEffect(() => {
    if (!user) return; // wait for an authenticated session before reading profiles (RLS)
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('id, employee_id, name, role, branch_id')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          if (error) console.error('[profiles] load failed:', error.message);
          return;
        }
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
    return () => { cancelled = true; };
  }, [user]);

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
