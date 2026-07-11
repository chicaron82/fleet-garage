import type { Profile, UserRole } from '../types';
import { isMockPersona } from './accountClassification';

const FLOOR_ROLES: UserRole[] = ['VSA', 'Lead VSA'];

/**
 * Crew candidates for the vehicle-audit name search: real floor staff (VSAs +
 * Lead VSAs, including roster-only ghosts) whose name matches the query. Demo
 * personas are excluded — you never assign a UV7 test account to a real audit.
 * An empty query returns nothing, so the dropdown stays quiet until they type.
 */
export function searchCrewCandidates(profiles: Profile[], query: string, limit = 6): Profile[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return profiles
    .filter(p => FLOOR_ROLES.includes(p.role) && !isMockPersona(p))
    .filter(p => p.name.toLowerCase().includes(q))
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, limit);
}
