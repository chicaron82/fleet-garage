import { useMemo } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import { USERS } from '../data/mock';
import { mergeTeamMembers } from '../lib/user-resolver';
import type { Profile } from '../types';

/**
 * Returns every team member known to the app — live profiles unioned with
 * the legacy USERS mock (deduped by id, profiles win on collision).
 *
 * Use this when a feature needs to LIST users (schedule grids, driver
 * coverage, recipient pickers) rather than do a point lookup. For point
 * lookups, use `useUserResolver`.
 *
 * Future cleanup: once the schedule/audit/fleet-balance flows are migrated
 * to real auth users, the USERS fallback drops out of this hook too.
 */
export function useTeamMembers(): Profile[] {
  const profiles = useProfiles();
  return useMemo(() => mergeTeamMembers(profiles, USERS), [profiles]);
}
