// Catch the roster up when the app comes back — the half realtime structurally cannot do.
//
// ⭐ THE BUG THIS EXISTS FOR (Aaron, 2026-09-12): *"i did the keytag audit sitting at couch command
// this morning. while i was out and about today seeing who's driving today. i noticed the audit
// still had keytags that needed to be audited. wasn't till i refreshed that it went away."*
// Two devices, hours apart. The couch device wrote; the phone had been in his pocket since before
// those writes and was still holding the roster it loaded that morning.
//
// ⚠️ REALTIME IS NOT A CATCH-UP MECHANISM, and this is the thing that is easy to get wrong. FG
// publishes `vehicles` (migration 141) and VehicleHoldContext subscribes to it, so a change made
// while the app is awake and connected does arrive. But `postgres_changes` has **no replay**: every
// event fired while the socket was down is gone permanently, and the client is never told it missed
// anything. A backgrounded PWA drops its socket within seconds. So the roster could only ever be as
// fresh as the last full load — which is why a manual refresh was the only thing that fixed it.
//
// ⭐ THE PATTERN ALREADY EXISTED, one surface over. `useAirportFlip` pulls on mount AND on
// visibility, and its comment describes this exact scenario: *"he flips on the phone, adds one on
// the computer, then picks the phone back up."* The flip list got the refocus pull; the **fleet
// roster — the biggest and most-used dataset in FG — never did.** A capability-parity gap: no file
// was wrong, one just had something its sibling lacked.
//
// ⚠️ DELTA, NOT A RELOAD, and the numbers are why. A full roster fetch is 803 rows / **1.2 MB**
// (holds is another 0.65 MB), and he opens FG standing in the lot on mobile data. Re-pulling that
// every time he wakes his phone would be worse than the bug. `updated_at` makes the cheap version
// safe: it is `DEFAULT now() NOT NULL` **and** stamped by the change-log trigger on every update
// (migration 132), so one filter catches registrations, edits and archives alike — typically zero
// rows, a few hundred bytes.
//
// ⚠️ The watermark is the newest `updated_at` FG has actually seen, never a client clock — the two
// machines' clocks are not the same clock, and a phone that is 30s fast would skip real rows
// forever. `gte` rather than `gt` re-reads the boundary row on purpose: one duplicate row costs
// nothing and is merged by id, while `gt` would drop anything written inside the same millisecond.
//
// ⚠️ Replacing a row with committed DB state is safe here for the same reason the realtime handler
// gives: a pending edit-suggestion is persisted (VehicleEditSuggestionSheet), so re-reading commits
// preserves it rather than clobbering an optimistic echo.
//
// ⚠️ KNOWN RESIDUAL, stated rather than papered over: this fires on foreground and on `online`. A
// socket that dies while the tab stays visible and the OS still calls the network "up" — a wifi
// association with no route, the lot's dead spot — leaves the roster stale with no event to catch.
// Closing that needs either a poll or a resubscribe hook on the channel itself; neither is here yet,
// because his reported case is the pocket, not the dead spot.
import { useEffect, useRef } from 'react';
import type React from 'react';
import { supabase } from '../lib/supabase';
import { mapVehicle } from '../lib/garage-mappers';
import type { Vehicle } from '../types';

/** Long enough that app-switching can't thrash it, short enough to be invisible to him. */
const MIN_INTERVAL_MS = 10_000;

export function useFleetSync(setAllVehicles: React.Dispatch<React.SetStateAction<Vehicle[]>>) {
  const watermark = useRef<string | null>(null);
  const lastRun = useRef(0);
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;

    /** Establish where "new" starts, without pulling the fleet to find out. */
    async function seed() {
      const { data } = await supabase.from('vehicles')
        .select('updated_at').order('updated_at', { ascending: false }).limit(1);
      if (!cancelled && data?.[0]) watermark.current = data[0].updated_at as string;
    }

    async function sync() {
      if (running.current || cancelled) return;
      if (document.visibilityState !== 'visible') return;
      if (Date.now() - lastRun.current < MIN_INTERVAL_MS) return;
      running.current = true;
      try {
        // A failed seed (offline at startup) leaves the mark null and simply defers — the next
        // foreground tries again, rather than the hook going permanently inert.
        if (!watermark.current) await seed();
        const since = watermark.current;
        if (!since || cancelled) return;

        const { data, error } = await supabase.from('vehicles').select('*')
          .gte('updated_at', since).order('created_at', { ascending: false });
        if (error || cancelled || !data) return;
        lastRun.current = Date.now();
        if (data.length === 0) return;

        watermark.current = data.reduce(
          (max, r) => ((r.updated_at as string) > max ? (r.updated_at as string) : max), since);
        const fresh = data.map(mapVehicle);

        setAllVehicles(prev => {
          const byId = new Map(fresh.map(v => [v.id, v]));
          const merged = prev.map(v => byId.get(v.id) ?? v);
          const known = new Set(prev.map(v => v.id));
          const added = fresh.filter(v => !known.has(v.id));
          // Newly-registered cars go to the FRONT, matching both the initial load's
          // `created_at desc` and the realtime INSERT handler. Appending would bury a car he
          // just registered at the bottom of his own list.
          return added.length ? [...added, ...merged] : merged;
        });
      } finally {
        running.current = false;
      }
    }

    const onVisible = () => { if (document.visibilityState === 'visible') void sync(); };
    void seed();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [setAllVehicles]);
}
