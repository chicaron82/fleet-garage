---
title:    Fuel pump readings in Shift Duties — Pump 1, Pump 2 tripwire, digital tank
author:   ZeeRah
area:     shift-duties
type:     feature
priority: low
status:   shipped
shipped:  2026-06-19
commit:   cd80fa5
---

## Problem

Fuel pump tracking is currently 100% paper (the gas pump card): two analog
gauges and one digital tank reading, reconciled by hand each shift. None of it
lives in FG, and one of the three readings — Pump 2 — exists specifically as a
loss-prevention tripwire: that side of the pump was taken out of service, and
its reading should never change from 1439. A past incident (1439 → 1201,
unrecorded) showed someone was using the disabled side undetected. The paper
process catches it only if a human notices the drift.

## Outcome wanted

A "Fuel Pump Readings" section under Shift Duties → My Shift, with three
reading groups:

**Pump 1 — Analog** (whole numbers, no decimal — gauge doesn't show fractions)
- Opening + Closing inputs
- Calculated "L pumped today" = Closing − Opening, shown live

**Pump 2 — Analog tripwire** (whole numbers)
- Single reading input, NOT prefilled (placeholder shows last recorded value
  as a hint only — the VSA must look at the gauge and type what they see)
- Shows "last recorded: 1439" for reference
- If the entered value differs from the last recorded value, surfaces a
  visible warning: "⚠️ Pump 2 changed from 1439 to [X] — this side shouldn't
  be in use, confirm the reading is accurate or flag for follow-up"
- This is NOT cosmetic — the changed-value warning is the entire point of the
  field. Do not auto-fill or auto-confirm; the act of a human reading and
  typing the gauge value each shift IS the control.

**Digital Tank Reading** (decimal precision — real instrument)
- Opening + Closing inputs
- Calculated delta shown live
- If closing > opening (tank went UP, meaning a top-up happened mid-shift),
  surface a note field: "e.g. Tank topped up mid-shift" so the anomaly has
  an explanation attached rather than just sitting as an unexplained increase

## Notes

- **Visual mock provided** (`fuel-reading-mock.jsx`) — matches FG's existing
  card style and yellow action lane. Use as the starting reference for layout,
  not a pixel-perfect spec — DiZee should adapt to FG's actual component
  library (`ModuleHeader`, `PrimaryAction`, etc.) rather than recreating raw
  Tailwind from the mock.
- **Pump 2's last-recorded value** needs to persist somewhere queryable across
  shifts — likely a new column on whatever shift-duties record stores this, or
  a dedicated small table if fuel readings warrant their own. DiZee's call on
  schema after grounding; needs a migration either way since this is new data.
- **Whole numbers for analog, decimals for digital** — input `step` and
  `inputMode` should reflect that (analog: `numeric`/`step="1"`; digital:
  `decimal`/default step).
- **This is genuinely bougie** — no urgent operational gap is being solved
  except Pump 2, which IS a real loss-prevention control. Pump 1 and Digital
  are closer to "nice to have a digital record instead of only paper." Scope
  and prioritize accordingly — Pump 2's tripwire behavior is the part worth
  getting exactly right; Pump 1/Digital can be simpler.
- **Surfacing in the shift report:** worth showing the Pump 2 changed-value
  flag in the shift report/summary if it fires, similar to how the airport
  flip flag surfaces context — an anomaly worth management seeing, not just
  buried in a form.

## Acceptance
- [x] Pump 1 has whole-number opening/closing inputs with live calculated
      litres pumped.
- [x] Pump 2 has a single whole-number input, not prefilled, shows last
      recorded value as reference text.
- [x] Entering a Pump 2 value different from the last recorded value surfaces
      a visible warning naming both the old and new values.
- [x] Digital tank reading has decimal-precision opening/closing inputs with
      live calculated delta.
- [x] A digital reading increase (closing > opening) surfaces an optional note
      field for explaining the top-up.
- [x] Pump 2's last recorded value persists and is read correctly on the next
      shift's entry. (Verified live: saved 1201 read back as the new baseline.)
- [x] A test covers: Pump 2 entered same as last recorded → no warning;
      entered different → warning fires (`pump2Drifted`, in `fuelReadings.test`).

## As-built

- **Lives in** `MyShiftView` Shift Duties tab, after the Closing Log (sits with
  the existing "Record gas meter numbers" closing step). Migration 080 adds
  `fuel_pump_readings`; maths in pure `fuelReadings.ts` (12 tests), state/load/
  save in `useFuelPumpReadings`.
- **Correction (Aaron, post-ship) — the baseline is FIXED at 1439, it does NOT
  drift.** First impl read "last recorded" = the most recent saved value and let
  it drift forward. Aaron clarified the real pump: the meter is *cumulative* (only
  climbs when fuel is pumped, never resets) and the side is *locked*, so it should
  read 1439 forever. Drift-forward was actively wrong — a saved high value would
  become the new normal and silence the catch. Reworked to a fixed
  `EXPECTED_PUMP2 = 1439` with a **directional** tripwire (`pump2Status`):
  **above → 'used'** (red — the locked side was used, the loss-prevention alarm),
  **below → 'fault'** (amber — a cumulative meter can't drop → fault/misread),
  **equal → ok**. The DB still records each shift's reading; the baseline is not
  read from it. Re-baselining after a legitimate use is a deliberate management
  action (future), not auto-drift. Verified live both directions + non-drift after
  a 1470 save. _Corrected post-ship — see git log for the directional-tripwire commit._
- **Deferral — shift-report surfacing of the Pump 2 flag is NOT built.** The
  ticket called it "worth showing… if it fires" (optional). It needs the report
  builder to load fuel data — a separate seam. Parked on the flagged-not-fixed
  board; wire it if management wants the alarm visible in the report.
- **Note** — adapted to FG dark-mode card style (not raw mock Tailwind), per the
  ticket. The mock's `LAST_PUMP2 = 1439` is the fixed `EXPECTED_PUMP2` baseline.
