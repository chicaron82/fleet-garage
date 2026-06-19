---
title:    Persistent active-session pill + collision guard for concurrent timers
author:   ZeeRah
area:     movement-log / off-standard / nav
type:     feature
priority: med
status:   shipped
shipped:  2026-06-19
commit:   fcfea0f
---

## Problem

Two timers can run simultaneously without any warning — a movement log trip and
an off-standard session can both be active at once with no indication either is
running while you're in a different module. Real scenario: drove back to the
washbay, forgot to end the trip, logged fleeting cars in Off-Standard, went back
to the airport — trip had been running the whole time unnoticed.

There's no cross-module signal that something is active, and no guard when
starting a new session while one is already running.

## Outcome wanted

**Layer 1 — Persistent active-session pill (the bougie one):**
A small pill/badge that follows the user across ALL modules whenever a trip OR
an off-standard timer is active. Always visible, never blocks. Examples:

- Trip active: `🚗 In Transit · 14m`
- OTH active: `⏱ Flipping Returns · 23m`
- Both active (the bug scenario): show both, or the longer-running one with a
  `+1` indicator

Tapping the pill jumps directly to the active session to end it. Lives in the
app shell / nav header so it persists regardless of which module is open.

**Layer 2 — Collision guard:**
When starting a NEW movement log trip while one is already `in_transit`, surface
a heads-up: *"You have an active trip (14m running). End it first, or continue
and let it keep running?"* Not a hard block — a deliberate speed bump that
prevents accidental double-logging without being paternalistic.

Same guard when starting a new OTH session while `timerState === 'running'`.

## Notes

- **Active state signals already exist and are exposed:**
  - Trip: `phase === 'in_transit'` from `useDriverLiveTrip`
  - OTH: `timerState === 'running'` + `inProgressId` from `useOffStandardSession`
  - Both need to be lifted to a shared context or read at the app-shell level so
    the pill can render outside the individual module components.
- **Pill placement:** app shell header alongside the notification bell — same
  level as `NotificationBell` in the nav. Always in the top bar, same position
  regardless of active module. DiZee's call on exact placement after grounding
  the shell structure.
- **Pill tap → deep link:** tapping the trip pill navigates to Movement Log,
  tapping the OTH pill navigates to Off-Standard Time. Uses existing
  `screenToPath` / deep-link infrastructure.
- **Elapsed time on the pill:** live-updating elapsed duration. The trip already
  tracks `departedAt`; OTH already tracks session start. Both are available for
  a live elapsed display.
- **Both active simultaneously:** if both a trip AND an OTH session are running
  (shouldn't happen operationally but clearly can), show both pills or the
  primary one with a `+1`. DiZee's call on layout — two pills may be fine, it's
  an edge case.
- **Collision guard wording:** keep it light, not alarming. "Still running from
  Xm ago — end it first?" is enough. Offer: End the old one, or proceed anyway.
  Don't block — just make it a deliberate choice.

## Acceptance
- [x] A persistent pill appears whenever a trip is `in_transit`. (Floats bottom-
      centre over any module, not the header — see As-built.)
- [x] A persistent pill appears whenever an OTH session is running.
- [x] The pill shows the activity label and live elapsed time.
- [x] Tapping the pill navigates to the relevant module + tab.
- [x] The pill disappears when the session ends.
- [x] Starting a trip while an OTH timer runs surfaces a collision guard.
- [x] Starting an OTH session while a trip runs surfaces a collision guard.
- [x] Both guards offer "end the old one" or "start anyway" — not a hard block.
- [x] If both are active simultaneously, both pills are visible.

## As-built

- **Correction — the VSA trip state is NOT in `useDriverLiveTrip`.** The ticket
  pointed at `phase === 'in_transit'` from that hook, but airport-flip trips run
  through `TripStartForm` (component-local `useState`), not the driver hook. So
  active-ness is read from the **DB `in_progress` rows** instead (`vsa_trips` by
  `driver_id`, `off_standard_entries` by `user_id`) — the same rows the modules
  recover from. New `ActiveSessionsContext` lifts that to the shell.
- **Decision (DiZee) — pill placement is a floating bottom-centre badge**, not the
  nav header. `NotificationBell` is mobile-header on small screens but Sidebar on
  desktop, so a header anchor would split. A fixed pill follows across every
  module on both layouts.
- **Decision — the guards that matter are cross-type.** Same-type collisions are
  already structurally prevented: the trip form is hidden during `in_transit`, and
  the OTH start hard-returns while `running`. So the guards fire trip-start-while-
  OTH and OTH-start-while-trip (the literal "forgot the trip, logged fleeting"
  bug). `useStartCollisionGuard` holds the start; `SessionCollisionGuard` is the
  shared card.
- **Decision — the movement tab is context-owned** (controlled state) so a pill
  tap selects it directly, avoiding a consume-and-clear focus signal + effect.
- **Note — instant + safety net.** Modules fire `refresh()` on start/end/discard/
  reset for immediate pill appear/clear; a 15s poll backstops forgotten/cross-tab
  sessions.
- **Deferral — `parseRecoveredQueue` extracted** from `TripStartForm` (line cap)
  into `vsa-trip.ts` + tested, as a side-effect of fitting the guard in.
