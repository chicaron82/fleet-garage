---
title:    Add "End Trip" for one-way movement log trips (no return queue)
author:   ZeeRah
area:     movement-log
type:     feature
priority: med
status:   shipped
shipped:  2026-06-19
commit:   925608d
---

## Problem

The movement log was designed around round trips — leave washbay, go somewhere,
come back. "✓ Back at Washbay" is the only way to end a trip, and it implies
a return. But airport flipping is one-way: you drive to the airport, stay there
flipping cars, and never come back to the washbay mid-shift. Tapping "Back at
Washbay" when you're not back is a lie in the record.

The real flow for airport flipping:
1. Log airport run → movement log starts
2. Arrive at airport → end the trip (you're staying here)
3. Switch to Off-Standard → log Flipping Returns time while at the airport
4. If/when you drive back later, that's a separate trip

There's no "Back at Washbay" moment in that flow. The current single end-state
doesn't model it.

## Outcome wanted

Two distinct end-state buttons when a trip is in progress:

- **✓ Back at Washbay** — round trip complete, you returned. Current behaviour
  unchanged: shows return queue reading, logs the full round-trip record.
- **⬛ End Trip** — one-way, you're staying at the destination. No return queue
  reading. Logs the trip as completed without a return.

The End Trip path skips the "WASHBAY QUEUE ON RETURN" field entirely — it's
irrelevant for a one-way trip and shouldn't be shown or required.

## Notes

- **Sub-5-minute confirm gate applies to both paths.** The existing short-trip
  confirm ("Only Xm — short for a real trip. Log it, or delete it?") should
  fire on End Trip too — a one-way trip that's under 5 minutes is just as
  suspicious as a round trip.
- **Return queue field:** currently marked `optional` on the form. For the
  End Trip path, hide it entirely — don't show it as optional, don't show it
  at all. The record stores null for return queue on one-way trips.
- **The two buttons replace the single "Back at Washbay" CTA** when a trip is
  active. Layout DiZee's call — side by side, or End Trip as a secondary action
  below the primary "Back at Washbay." The round-trip path should still feel
  like the primary action since it's the more common case.
- **Trip type distinction in the record:** worth storing whether a completed
  trip was round-trip or one-way (e.g. a `oneWay: boolean` field) so the
  movement log history can show the distinction. DiZee's call on whether this
  needs a migration or can be derived from null return queue. Ground first.
- **No change to the departure flow** — the form (queue at departure,
  authorization, context/delays) is identical for both trip types. The
  distinction only happens at the end.

## Acceptance
- [x] When a trip is in progress, two end-state buttons are visible: "Back at
      Washbay" and "End Trip."
- [x] "Back at Washbay" behaves exactly as today — return queue field shown,
      round-trip record logged.
- [x] "End Trip" logs the trip one-way/completed-without-return with the return
      queue stored null. (Field visibility: see As-built.)
- [x] The sub-5-minute short-trip confirm fires on both paths.
- [x] The movement log history distinguishes round-trip from one-way entries.
- [x] A test covers: End Trip path → return queue is null, trip marked one-way.

## As-built

- **Correction — the short-trip confirm did NOT exist in this flow.** The ticket
  said it "should fire on End Trip *too*," implying Back-at-Washbay already had
  it. It didn't: the VSA flow (`TripStartForm`/`TripInTransit`) went straight to
  the write. Only the *driver* flow (`DriverLiveTransitView`) had the gate. So it
  was added fresh to this flow, gating both end-states, reusing the driver-flow
  copy + `TRIP_DURATION_THRESHOLDS.short`.
- **Decision — `one_way` needs a column (migration 079), can't be derived.** Null
  `queue_at_arrival` is ambiguous: it's already optional on round trips. Explicit
  boolean, default false. `buildArrivalUpdate()` owns the queue-nulling so the
  round-trip write is byte-for-byte unchanged.
- **Decision (DiZee) — return-queue field stays inline, visible during transit.**
  The ticket asked to "hide it entirely" on the End Trip path, but the path is
  only chosen at button-tap (both buttons share one screen). Round trip is the
  common case, so the field stays one-tap; End Trip ignores it and stores null
  (the record honours "no return queue"). Labelled "round trip · optional" to
  signal ownership.
