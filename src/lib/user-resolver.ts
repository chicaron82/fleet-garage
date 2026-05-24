// User resolution — pure interface for resolving Supabase auth UUIDs to
// display info. Implemented as a stable React hook in useUserResolver.ts.
//
// Historical note: the original code used a USERS mock keyed on fake ids
// ('u1'–'u17'). All users have had real Supabase auth accounts since
// migration 057. The mock fallback was retired in migration 061.

import type { Profile, UserRole } from '../types';

export interface UserResolver {
  /** Returns a display name, or `'Unknown'` if all sources are exhausted. */
  getName:    (id: string, snapshot?: string) => string;
  /** Returns the role, or `''` if no source has one. */
  getRole:    (id: string) => UserRole | '';
  /** Returns an employee id, or `''` if no source has one. */
  getEmpId:   (id: string, snapshot?: string) => string;
  /** Raw lookup by id. `null` if the id isn't in profiles. */
  getProfile: (id: string) => Profile | null;
  /** Lookup by employee id (e.g. for audit forms keyed on EMP1234). */
  getByEmployeeId: (employeeId: string) => Profile | null;
}
