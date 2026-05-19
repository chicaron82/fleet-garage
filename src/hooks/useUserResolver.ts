import { useMemo } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import { USERS } from '../data/mock';
import { createUserResolver, type UserResolver } from '../lib/user-resolver';

/**
 * React adapter for `createUserResolver`. Combines live Supabase `profiles`
 * with the legacy USERS mock so dev/mock data (keyed on `'u1'`, `'u2'`...)
 * still resolves while production data (keyed on auth UUIDs) resolves via
 * profiles.
 *
 * Future cleanup: once the schedule/audit code paths are migrated to real
 * auth users too, the USERS fallback can be dropped entirely.
 */
export function useUserResolver(): UserResolver {
  const profiles = useProfiles();
  return useMemo(() => createUserResolver(profiles, USERS), [profiles]);
}
