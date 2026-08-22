import type { Screen } from '../types';

export function screenToPath(screen: Screen): string {
  switch (screen.name) {
    case 'dashboard':       return '/';
    case 'my-day':          return '/my-day';
    case 'vehicle':         return `/vehicle/${screen.vehicleId}`;
    case 'my-shift':        return '/shift';
    case 'schedule':        return '/schedule';
    case 'lost-and-found':  return '/lost-and-found';
    case 'fleet-master':    return '/fleet';
    case 'zone-backfill':   return '/damage-zones';
    case 'movement-log':    return '/movement-log';
    case 'audits':          return '/audits';
    case 'analytics':       return '/analytics';
    case 'issue-log':       return '/issue-log';
    case 'manifest':        return '/manifest';
    case 'effie':           return '/effie';
    // Wizard screens carry context that doesn't survive a fresh load — no stable URL.
    case 'new-hold':
    case 'register-vehicle':
    case 'audit-form':
      return '/';
  }
}

export function pathToScreen(path: string): Screen | null {
  if (path === '/' || path === '/holds') return { name: 'dashboard' };
  const vehicleMatch = path.match(/^\/vehicle\/(.+)$/);
  if (vehicleMatch) return { name: 'vehicle', vehicleId: vehicleMatch[1] };
  switch (path) {
    case '/my-day':         return { name: 'my-day' };
    // '/my-shift' aliases the canonical '/shift' — the module is NAMED 'my-shift'
    // and '/my-day' is a real path, so it's the natural guess (a 2026-07-16
    // verify-fg run typed it, got a null deep-link, and read the last-visited
    // fallback as a landing-pref bug). Canonical stays '/shift' (screenToPath).
    case '/my-shift':
    case '/shift':          return { name: 'my-shift' };
    case '/schedule':       return { name: 'schedule' };
    case '/lost-and-found': return { name: 'lost-and-found' };
    case '/fleet':          return { name: 'fleet-master' };
    case '/damage-zones':   return { name: 'zone-backfill' };
    case '/movement-log':   return { name: 'movement-log' };
    case '/audits':         return { name: 'audits' };
    case '/analytics':      return { name: 'analytics' };
    case '/issue-log':      return { name: 'issue-log' };
    case '/manifest':       return { name: 'manifest' };
    case '/effie':          return { name: 'effie' };
    default:                return null;
  }
}

// ── Going back ─────────────────────────────────────────────────────────────────────────────────
// ⭐ THE BUG THIS FIXES (Aaron, 2026-08-22): "when i look up a car in fleet module and open it up.
// then hit back, i'm taken to the holds module instead of back to the fleet module."
//
// FG has always had a real history stack — `navigate` pushes, and a popstate handler restores the
// screen — so the browser and Android back buttons were correct all along. The in-app "← Back"
// buttons were not: each one called `navigate({ name: 'dashboard' })`, which PUSHES the Holds
// dashboard rather than popping. Two things went wrong at once. He landed in the wrong module, and
// the stack grew on every back-tap, so the hardware back button then walked him forwards through
// screens he had already left.
//
// Depth is stamped into each pushed history entry so "is there anywhere to go back to" is a fact we
// can read rather than a count we have to keep in sync across pushes, pops and refreshes.

/** The app-root sentinel sits at depth 0; the first real screen is depth 1. */
export const ROOT_DEPTH = 0;

export interface HistoryDepth { _depth?: number }

/** Depth of the entry currently on top of the stack. */
export function depthOf(state: unknown): number {
  return (state as HistoryDepth | null)?._depth ?? ROOT_DEPTH;
}

/**
 * What "← Back" should do from here.
 *
 * `pop` whenever there is a real previous screen — that is what returns him to the module he came
 * from, whichever one it was. Only at depth 1 (a deep link, a fresh login, a refresh straight onto
 * a record) is there nothing behind us, and popping there would hit the app-root sentinel and raise
 * the log-out prompt: a hard no for a button labelled Back. There we navigate to the caller's
 * fallback, which is exactly today's behaviour, kept for the one case where it was ever right.
 */
export function backAction(state: unknown): 'pop' | 'fallback' {
  return depthOf(state) > 1 ? 'pop' : 'fallback';
}
