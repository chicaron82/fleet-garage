---
title:    Put a behaviour-locking test net under useVehicleOperations
author:   DiZee
area:     holds
type:     chore
priority: med
status:   shipped
shipped:  2026-06-11
commit:   0674161
---

## Problem

`src/context/useVehicleOperations.ts` (349 lines, right under the cap) is where
the riskiest multi-write logic in FG concentrates: every hold/release/repair/
return op flows through it, and a wrong write here lands a vehicle in the wrong
status for the whole crew. It is also the largest piece of untested risk left —
the lib layer under it is well covered (`vehicle-status`, `holdResolution`
contracts), but the slice hook that *sequences* those writes has no direct
tests. Today its behaviour is locked only by manual use.

Both deep-dive reviews (2026-06-09 and 2026-06-11, Fable-5) nominated it as the
next test-first candidate. The precedent is `useDriverLiveTrip` (2026-06-04,
`5cca687`): on a fragile, untested file, the net comes first — that's what
turned a redo-prone rewrite into a safe refactor, and it caught the orphan-bug
footgun in the same pass.

## Outcome wanted

The hook's observable behaviour is locked by tests BEFORE any future refactor
touches it: each op's happy path, its throw-on-primary-write-failure contract,
and the optimistic-state gating (state flips only after the write lands). A
future session can then consolidate or extract with proof of behaviour
preservation — same play as `useDriverLiveTrip`.

Explicitly NOT in scope: fixing the known non-atomic follow-up writes (that's
the separate RPC item in the backlog, deferred by design). The net documents
today's behaviour, including that gap.

## Notes

- Known deferred gap to *document, not fix*: follow-up status updates are
  best-effort after the primary write throws-on-failure (see Flagged-Not-Fixed,
  "Multi-write ops aren't atomic").
- `tests/lib/in-progress-recovery.test.ts` has the fake-Supabase pattern to
  reuse; `tests/hooks/useDriverLiveTrip.test.ts` shows the hook-level harness.
- The batch path (`makeMarkRepairedBatch`) got its cross-vehicle guard 2026-06-11;
  the single-op paths are the ones still walking without a net.

## Acceptance

- [x] Every exported op of `useVehicleOperations` has at least one
      behaviour-locking test (happy path + primary-write-failure).
- [x] Tests pass against the CURRENT implementation unchanged (net first —
      no refactoring in the same commit as the net).
- [x] A deliberately-broken write sequence (e.g. swap optimistic flip before
      write) fails the suite — the net actually catches regressions.
