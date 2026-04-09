# Kitchen Ticket — Fleet Garage
## Scope Tightening: Damage Ledger, Not Fleet Registry

**Date:** April 8, 2026
**Verified against:** fleet-garage-master
**Priority:** P1 — scope clarity before pitch

---

## The Problem

Fleet Garage is a damage hold ledger. The current mock data
and UI include vehicles with no damage history sitting in
IN_FLEET status. This blurs the product's purpose.

The system doesn't need to know about every car on the lot.
It needs to know about every car that has been flagged for damage.

Three things need tightening:

**Gap 1 — Mock data includes undamaged vehicles**
HRZ-6614 (Nissan Altima, v4) has IN_FLEET status and no hold
records. It doesn't belong in a damage ledger. Removes the wrong
impression that Fleet Garage is a general fleet registry.

**Gap 2 — VehicleStatus includes IN_FLEET**
If a vehicle is in Fleet Garage it has damage history.
IN_FLEET as a status implies the system tracks all vehicles
regardless of damage state. The correct statuses for this
system are HELD, OUT_ON_EXCEPTION, and RETURNED.

**Gap 3 — "Register Vehicle" framing**
The current label suggests adding to a fleet registry.
The correct framing is adding a damaged unit to the ledger
for the first time — a one-time onboarding step before
flagging damage, not a fleet management action.

---

## The Fix

### 1. Mock Data — Remove undamaged vehicles

**File:** `src/data/mock.ts`

Remove from VEHICLES array:
- `v4` — HRZ-6614, Nissan Altima, IN_FLEET, no holds

Keep all vehicles that have at least one hold record.
Keep `v4` (HRZ-6614 / LFJ108) if it has holds — check before deleting.

Update any remaining vehicle statuses:
- Remove IN_FLEET from status values in the data
- All seeded vehicles should be HELD, OUT_ON_EXCEPTION, or RETURNED

---

### 2. Types — Remove IN_FLEET from VehicleStatus

**File:** `src/types/index.ts`

Replace:
```ts
export type VehicleStatus = 'IN_FLEET' | 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED';
```

With:
```ts
export type VehicleStatus = 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED';
```

A vehicle only exists in Fleet Garage because it has damage history.
IN_FLEET implies the system is tracking vehicles without damage — it isn't.

---

### 3. Dashboard — Remove IN_FLEET from summary and table

**File:** `src/components/Dashboard.tsx`

The three summary cards (Held, On Exception, Returned) are correct
and stay. Remove any references to IN_FLEET filtering or display.

The vehicle table should only show vehicles with at least one hold.
If a vehicle somehow has no holds it shouldn't appear in the system.

---

### 4. Rename "Register Vehicle" → "Add to Ledger"

**Files:** `src/components/RegisterVehicleForm.tsx`,
`src/components/NewHoldForm.tsx`, `src/App.tsx`

Update all user-facing labels:
- "Register Vehicle" → "Add to Ledger"
- "Register & flag this vehicle →" → "Add to ledger & flag →"
- Form heading: "Register New Vehicle" → "Add Vehicle to Ledger"
- Submit button: "Register" → "Add to Ledger"

The framing shift: this isn't adding a car to a fleet registry,
it's the first time this damaged unit has been seen by the system.

---

### 5. GarageContext — Set initial status to HELD on add

**File:** `src/context/GarageContext.tsx`

Currently `addVehicle` sets `status: 'IN_FLEET'` on creation.
Since vehicles only enter the system to be flagged for damage,
the add flow immediately creates a hold anyway (via NewHoldForm).

The vehicle status is set to HELD by `addHold()` immediately after.
The IN_FLEET interim state is invisible to the user but incorrect.

If IN_FLEET is removed from VehicleStatus, update `addVehicle` to
set `status: 'HELD'` as the initial state — consistent with the
fact that every vehicle entering the system is being flagged.

---

## Done When

- No undamaged IN_FLEET vehicles in mock data
- VehicleStatus type has no IN_FLEET
- Dashboard shows only vehicles with damage history
- All "Register Vehicle" labels read "Add to Ledger"
- No TypeScript errors
- All existing flows still work

---

💚 Fleet Garage — Kitchen ticket by Zee, Apr 8 2026
*Fleet Garage tracks damaged vehicles. Not all vehicles. Scope is the feature.*
