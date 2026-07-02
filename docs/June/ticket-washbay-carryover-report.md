---
title:            Show carry-over in shift report PDF
author:           DiZee
area:             washbay
type:             feature
priority:         low
status:           shipped
shipped:          2026-06-07
commit:           202bd6e
---

## Problem

`carryOver` is read from the database and included in the shift report context
object (`ShiftReportExport.tsx` line 231), but `ShiftReportPDFSections.tsx`
never outputs it. The data is there; the line is not.

## Outcome wanted

When `carryOver > 0`, the washbay section of the shift report PDF should
include a line:

```
Carry-over from previous shift: 11 vehicles
```

Same conditional-display pattern as other optional washbay lines.

## Notes

The value is already in the report data object — this is a pure rendering
addition in `ShiftReportPDFSections.tsx`. No DB changes, no new fetches.

Split from `ticket-washbay-carryover-queue.md` (shipped a9274c9) — that
ticket was marked shipped as-is since the closing log, history annotation,
and backfill form are all working. The report line was the only gap.

## Acceptance

- [ ] Shift report PDF shows "Carry-over from previous shift: N vehicles" when `carryOver > 0`
- [ ] No output when `carryOver === 0`
- [ ] `npx tsc -b` clean, `npx vitest run` green
