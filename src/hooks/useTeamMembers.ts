import { useMemo } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import type { Profile } from '../types';

/**
 * Returns every team member known to the app — all live profiles from Supabase.
 *
 * Use this when a feature needs to LIST users (schedule grids, driver
 * coverage, recipient pickers) rather than do a point lookup. For point
 * lookups, use `useUserResolver`.
 */
export function useTeamMembers(): Profile[] {
  const profiles = useProfiles();
  return useMemo(() => Array.from(profiles.values()), [profiles]);
}
