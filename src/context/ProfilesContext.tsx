import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { buildRosterStaff } from '../lib/rosterStaff';
import { promoteRosterStaff as promoteRosterStaffRpc } from '../lib/rosterPromotion';
import type { Profile, UserRole, BranchId } from '../types';

const ProfilesContext = createContext<Map<string, Profile>>(new Map());

interface RosterStaffActions {
  /** Create a board-only staffer (no login) and add them to the profiles map. */
  addRosterStaff: (input: { name: string; role: UserRole; branchId: BranchId }) => Promise<Profile>;
  /** Remove a roster-only staffer. RLS only permits deleting roster_only rows. */
  removeRosterStaff: (id: string) => Promise<void>;
  /** Promote a roster ghost to a real account: carries its shift history to the
   *  out-of-band auth account and retires the ghost (migration 085 RPC). */
  promoteRosterStaff: (rosterId: string, employeeId: string) => Promise<Profile>;
}
const RosterStaffContext = createContext<RosterStaffActions | null>(null);

function rowToProfile(row: Record<string, unknown>): Profile {
  return {
    id:         row.id as string,
    employeeId: row.employee_id as string,
    name:       row.name as string,
    role:       row.role as UserRole,
    branchId:   row.branch_id as BranchId,
    rosterOnly: (row.roster_only as boolean) ?? false,
    utility:    (row.utility as boolean) ?? false,
  };
}

/**
 * Loads every row from `profiles` (migration 054) and exposes them as a
 * `Map<id, Profile>` — the source of truth for resolving Supabase auth UUIDs
 * to display info, consumed by `useUserResolver`. Roster-only staff (migration
 * 082) live in the same map; they just have no auth account behind them.
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
      .select('id, employee_id, name, role, branch_id, roster_only, utility')
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data) {
          if (error) console.error('[profiles] load failed:', error.message);
          return;
        }
        const next = new Map<string, Profile>();
        for (const row of data as Record<string, unknown>[]) next.set(row.id as string, rowToProfile(row));
        setProfiles(next);
      });
    return () => { cancelled = true; };
  }, [user]);

  const addRosterStaff = useCallback(
    async (input: { name: string; role: UserRole; branchId: BranchId }): Promise<Profile> => {
      const staff = buildRosterStaff(input);
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id:          staff.id,
          employee_id: staff.employeeId,
          name:        staff.name,
          role:        staff.role,
          branch_id:   staff.branchId,
          roster_only: true,
        })
        .select('id, employee_id, name, role, branch_id, roster_only, utility')
        .single();
      if (error) throw error;
      const created = rowToProfile(data as Record<string, unknown>);
      setProfiles(prev => new Map(prev).set(created.id, created));
      return created;
    },
    [],
  );

  const removeRosterStaff = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('profiles').delete().eq('id', id);
    if (error) throw error;
    setProfiles(prev => {
      const next = new Map(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const promoteRosterStaff = useCallback(async (rosterId: string, employeeId: string): Promise<Profile> => {
    const promoted = await promoteRosterStaffRpc(rosterId, employeeId);
    setProfiles(prev => {
      const next = new Map(prev);
      next.delete(rosterId);           // ghost retired
      next.set(promoted.id, promoted); // real account now resolves
      return next;
    });
    return promoted;
  }, []);

  return (
    <ProfilesContext.Provider value={profiles}>
      <RosterStaffContext.Provider value={{ addRosterStaff, removeRosterStaff, promoteRosterStaff }}>
        {children}
      </RosterStaffContext.Provider>
    </ProfilesContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useProfiles(): Map<string, Profile> {
  return useContext(ProfilesContext);
}

// eslint-disable-next-line react-refresh/only-export-components
export function useRosterStaff(): RosterStaffActions {
  const ctx = useContext(RosterStaffContext);
  if (!ctx) throw new Error('useRosterStaff must be used within ProfilesProvider');
  return ctx;
}
