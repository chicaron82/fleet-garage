---
title:            Add carry-over queue field to washbay closing log
author:           ZeeRah
area:             washbay
type:             feature
priority:         med
status:           shipped
shipped:          2026-06-07
commit:           a9274c9
---

## Problem

When the closing shift leaves vehicles in the queue, the next morning's crew
inherits that backlog. Today's example: 11 vehicles queued from last night,
cleaned this morning as part of a 24-vehicle session in 2.5h. The throughput
rate (9.6/hr) is accurate, but FG has no way to record that 11 of those 24
were inherited debt — the context that makes the number meaningful is lost.

`carsRemaining` captures queue at close. `cleanNotPickedUp` captures clean
but not dispatched. Neither captures "came in already queued from last shift."

## Outcome wanted

A "Carry-over from last night" field in the closing log form — how many
vehicles were in the queue at the START of the shift (inherited from
the previous close). Optional, defaults to 0.

The field is informational/contextual — it doesn't affect the throughput
calculation, it annotates it. In the history view, a day with carry-over
should show a note: "incl. 11 carry-over" next to the cleaned count so
the story is legible at a glance.

## Notes

**Migration `071_washbay_carryover.sql`:**
```sql
ALTER TABLE washbay_logs
  ADD COLUMN IF NOT EXISTS carry_over integer NOT NULL DEFAULT 0;
ALTER TABLE washbay_backfill_logs
  ADD COLUMN IF NOT EXISTS carry_over integer NOT NULL DEFAULT 0;
```
Both tables get it — backfill entries for past days should also be
able to record carry-over context.

**Type update — `src/types/index.ts`:**
```ts
// in WashbayLog:
carryOver: number; // Vehicles inherited from previous shift's queue
```

**`WashbayClosingLog.tsx`** — add a stepper field for carry-over,
same style as team size. Position: after "In queue at close" and before
"Clean, not picked up" — it reads logically as "started with X, ended
with Y." Label: "Carry-over from last night". Default: 0.

**`WashbayHistorySection.tsx`** — in the history row display, when
`carryOver > 0` show a dimmed annotation alongside the cleaned count:
`46 cleaned · 11 carry-over` — same line, smaller/dimmed text, no
color (it's context, not a status).

**`WashbayBackfillForm`** (inside `WashbayHistorySection`) — same
stepper, same default 0. Pre-fill from previous backfill entry same
as team size (yesterday's carry-over is rarely the same as today's,
but the field should be there for completeness).

**`buildShiftReport`** — if `carryOver > 0`, include it in the
washbay section of the shift report:
`"Carry-over from previous shift: 11 vehicles"`

DiZee: ground the `WashbayClosingLog` form structure before adding
the field — it's one of the denser components. Check line count
before and after.

## Acceptance
- [ ] "Carry-over from last night" stepper appears in closing log form
- [ ] Defaults to 0, saves correctly to DB
- [ ] History row shows "incl. X carry-over" annotation when > 0
- [ ] Backfill form also has the field
- [ ] Shift report includes carry-over line when > 0
- [ ] `npx tsc -b` clean, `npx vitest run` green
