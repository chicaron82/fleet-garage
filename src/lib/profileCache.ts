import type { User } from '../types';

// Offline-auth bridge. Supabase persists the session *token* across reloads, so
// an offline reload restores the session — but AuthContext's fetchProfile() is a
// network read of `profiles`, which fails offline and would dump a logged-in VSA
// back to the login screen (no way back in without signal). We cache the profile
// on every successful fetch and, ONLY when genuinely offline, ride it so the
// crew keeps access on a dead-wifi reload.

const KEY_PREFIX = 'fg_profile_';

export function cacheProfile(profile: User): void {
  try {
    localStorage.setItem(KEY_PREFIX + profile.id, JSON.stringify(profile));
  } catch {
    /* storage full / disabled — the cache is best-effort, never load-bearing */
  }
}

export function getCachedProfile(userId: string): User | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + userId);
    if (!raw) return null;
    const p = JSON.parse(raw) as User;
    // Identity guard: never hand back a profile for a different user id than asked.
    return p && p.id === userId ? p : null;
  } catch {
    return null; // corrupt JSON / disabled storage → no cache
  }
}

export function clearProfileCache(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(KEY_PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    /* best-effort */
  }
}

/**
 * The profile to restore when the live profile-fetch returned null. The security
 * gate: only an `INITIAL_SESSION` reload while **genuinely offline** may ride the
 * cached profile. An *online* null means the profile is gone (deactivated /
 * deleted) → no restore, require login — a stale cache must never grant access
 * to someone the server has cut off.
 */
export function restoreOnNullProfile(
  event: string,
  isOnline: boolean,
  cached: User | null,
): User | null {
  return event === 'INITIAL_SESSION' && !isOnline ? cached : null;
}
