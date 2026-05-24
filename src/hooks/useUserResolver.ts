import { useMemo } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import type { UserResolver } from '../lib/user-resolver';

/**
 * Returns a UserResolver that re-creates when profiles load, so display
 * components (hold attribution, shift names, etc.) re-render with correct data.
 *
 * ScheduleContext deliberately breaks the cascade at loadShifts using
 * rowToShiftRef — that's the targeted fix for the auto-load double-fire.
 * This hook stays reactive so the rest of the app updates normally.
 */
export function useUserResolver(): UserResolver {
  const profiles = useProfiles();

  return useMemo((): UserResolver => {
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
  }, [profiles]); // reactive — re-creates when profiles load so display components update
}
