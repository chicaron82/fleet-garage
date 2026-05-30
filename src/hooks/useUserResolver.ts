import { useMemo } from 'react';
import { useProfiles } from '../context/ProfilesContext';
import { createUserResolver } from '../lib/user-resolver';
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

  // reactive — re-creates when profiles load so display components update
  return useMemo((): UserResolver => createUserResolver(profiles), [profiles]);
}
