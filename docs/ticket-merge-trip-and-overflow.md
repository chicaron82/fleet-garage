---
title: One plate input, two outcomes — merge the trip form and the overflow send
author: Aaron (the design) — DiZee (the build)
area: fleet-garage / movement log
type: feature
status: open
opened: 2026-09-09
---

# The Movement Log asks "which car?" twice

## His design, verbatim

> *"what say we combine the two sends. typing out a plate could serve as the fallback if i don't have
> the keytag(s) on me. and if it happens to be overflow, then i'll tap AV Flight or FastAir and it
> gets logged"*
>
> *"an airport trip would still be timed. enter/scan plate. tap the quick start button.
> overflow would be enter/scan plate. tap where its going. and it just logs where it was sent"*

⭐⭐ **The insight: the INPUT is identical and only the OUTCOME differs.** `TripStartForm` and
`OverflowSendForm` are stacked siblings that both open by asking which vehicle, in two different
ways, with two different scan buttons. The car is the same question. **The button you tap is the
whole decision.**

```
VEHICLE PLATE  [ E.G. LUR156 ]   [📷 Scan Key Tag]  [📎 Attach a stack]

START TRIP  (timed — runs a clock)
  [ Routine Transport  → ]
  [ Coverage Assist    → ]

SEND TO OVERFLOW  (logged — where it went, no timer)
  [ AV Flight ]   [ FastAir ]
```

## ⚠️ The two outcomes stay different, deliberately

I floated giving overflow sends real durations once merged. **He rejected it, and he is right:** an
overflow send is frequently logged AFTER the fact, in a batch, off a stack of tags — there is
nothing to time. **A trip is LIVE; a send is REPORTED.** Different verbs, same subject.

- trip → live timer, start/elapsed/complete, real duration
- send → one completed one-way `vsa_trips` row, `0m`, logged on the tap

## ⭐ AND THE AIRPORT BUTTON GOES

> *"an overflow sent to the airport is redundant. airport is the default. if there's no room we
> offload some to AV Flight and FastAir"*

✅ **Confirmed by a row I wrote myself on 2026-09-09 17:20**, correcting LFJ360's move: it renders
`Airport Run → Airport`. Nonsense on its face. If the destination IS the airport, it is an airport
run — the overflow form exists for the spots used *when the airport will not take them*.

⚠️⚠️ **BUT `'Airport'` MUST REMAIN A VALID STORED VALUE.** Effie's `lookup_sent` groups by
`arrive_location` and there is history holding `'Airport'`. This is **remove the button and stop
writing it**, NOT remove it from `OverflowDestination` — the second silently breaks the manifest and
every past send to the airport.

## Scope

- [ ] One plate/scan input feeding both outcome groups; typed plate is the keytag fallback.
- [ ] `Attach a stack` (the batch reader, shipped `c3bf163`) stays available to the overflow path.
- [ ] Trip buttons keep the live timer; overflow buttons keep the instant log.
- [ ] Drop the **Airport** chip from the overflow row. Keep the enum value and every read path.
- [ ] ⚠️ `ScanButton`'s dashed-outline variant was a DROP-ZONE affordance, not an overflow marker
      (its own comment says so). Merging dissolves the distinction — do not preserve the dashes out
      of habit.
- [ ] Gate green — unpiped.

## Not in scope

The 0m duration on overflow rows is CORRECT, not a bug. See above.
