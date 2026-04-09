# Kitchen Ticket — Fleet Garage
## Smooth the Flag → Register → Damage Flow

**Date:** April 8, 2026
**Verified against:** fleet-garage-master
**Priority:** P1 — friction in the primary use case

---

## The Problem

Three gaps in the vehicle flagging flow create unnecessary steps:

**Gap 1 — Dashboard search dead-ends on no result**
Dashboard has its own search bar. If you type a unit # or plate
and get no results, you see:
`"No vehicles match your search."`
No next step. No register button. User has to manually tap
`+ Flag Vehicle` to start over in NewHoldForm.

**Gap 2 — RegisterVehicleForm loses context on Back**
`onBack` in RegisterVehicleForm navigates to `dashboard`.
If the user arrived from NewHoldForm → `+ Register vehicle →`,
pressing Back dumps them on the dashboard instead of returning
to the hold form. Context lost.

**Gap 3 — Post-registration lands on history, not damage form**
After registering a new vehicle, `onSuccess` in RegisterVehicleForm
navigates to `VehicleHistory`. Correct destination — but the user
still has to tap `Flag Damage` manually. They just registered a
vehicle specifically to flag damage. One extra tap that shouldn't exist.

---

## The Fix

### 1. Dashboard — Add "Register & Flag" to no-results state

**File:** `src/components/Dashboard.tsx`

Replace:
```tsx
{filtered.length === 0 && (
  <p className="text-center text-gray-400 text-sm py-8">
    No vehicles match your search.
  </p>
)}
```

With:
```tsx
{filtered.length === 0 && search.trim().length >= 2 && (
  <div className="text-center py-8 space-y-3">
    <p className="text-gray-400 text-sm">
      "{search}" not in the system.
    </p>
    <button
      onClick={onRegisterAndFlag}
      className="text-sm font-semibold text-yellow-600 hover:text-yellow-800 transition cursor-pointer"
    >
      + Register & flag this vehicle →
    </button>
  </div>
)}
```

Add `onRegisterAndFlag: () => void` to `Dashboard` Props interface.

---

### 2. App.tsx — Add register-from-hold screen + pass searched value

**File:** `src/App.tsx`

Add new screen type:
```ts
| { name: 'register-vehicle'; fromHold?: boolean }
```

Update new-hold screen to pass `fromHold: true`:
```tsx
onRegisterNew={() => setScreen({ name: 'register-vehicle', fromHold: true })}
```

Update register-vehicle screen:
```tsx
if (screen.name === 'register-vehicle') {
  return (
    <RegisterVehicleForm
      onBack={() =>
        screen.fromHold
          ? setScreen({ name: 'new-hold' })
          : setScreen({ name: 'dashboard' })
      }
      onSuccess={(vehicleId) => setScreen({ name: 'new-hold', vehicleId })}
    />
  );
}
```

Add Dashboard `onRegisterAndFlag` prop:
```tsx
<Dashboard
  onSelectVehicle={(vehicleId) => setScreen({ name: 'vehicle', vehicleId })}
  onNewHold={() => setScreen({ name: 'new-hold' })}
  onRegisterAndFlag={() => setScreen({ name: 'register-vehicle' })}
/>
```

---

### 3. RegisterVehicleForm — Accept and pass vehicleId on success

**File:** `src/components/RegisterVehicleForm.tsx`

No changes needed to the component itself — the `onSuccess(vehicleId)`
callback already passes the new vehicle's ID. The fix in App.tsx
routes that ID into `new-hold` with the vehicle pre-selected,
so the damage form opens directly with the vehicle confirmed.

---

## The Fixed Flow

**From Dashboard (new vehicle):**
```
Dashboard → search → no result → "+ Register & flag this vehicle →"
→ RegisterVehicleForm → fill in details → Register
→ NewHoldForm (vehicle pre-selected) → fill in damage → Flag
→ VehicleHistory (hold confirmed)
```

**From NewHoldForm (new vehicle):**
```
NewHoldForm → search → no result → "+ Register vehicle →"
→ RegisterVehicleForm → Back → NewHoldForm (context preserved)
→ OR → Register → NewHoldForm (vehicle pre-selected)
```

**From VehicleHistory (existing vehicle):**
```
Unchanged — already works correctly
```

---

## Done When

- Dashboard no-results state shows register button when search ≥ 2 chars
- Back from RegisterVehicleForm returns to NewHoldForm when fromHold=true
- Post-registration navigates to NewHoldForm with vehicle pre-selected
- No TypeScript errors
- All existing flows still work

---

💚 Fleet Garage — Kitchen ticket by ZeeRah, Apr 8 2026
*One search. One decision. No redundant steps.*
