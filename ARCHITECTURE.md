# Fleet Garage — Architecture Notes

## Write-First Pattern

Any feature that starts a timed session (trip, off-standard entry, or similar)
and needs to survive React component unmount (navigation, screen lock, tab switch)
MUST write to Supabase before updating React state.

**Rule:** `await supabase.insert()` → confirm success → THEN set state.

**Never:** set state optimistically, then delegate the write to a parent callback.

### Reference implementations

- `src/hooks/useOffStandardTimer.ts` → `handleStartWith` — canonical correct example
- `src/hooks/useDriverLiveTrip.ts` → `handleStart` — uses `writeOrEnqueue` helper (see Payload Deduplication below)
- `src/components/movement/TripStartForm.tsx` → `handleStartTripWith` — fixed May 2026

### Recovery half of the contract

The write-first rule is paired with a mount-time `useEffect` that queries for
`status = 'in_progress'` and rehydrates UI state. This is what makes the survival
guarantee end-to-end: write must land BEFORE unmount, and recovery must find it
on next mount.

Use `useInProgressRecovery` (in `src/hooks/`) for the recovery half — it wraps
the shared pure helper `recoverInProgress` in `src/lib/in-progress-recovery.ts`,
which is unit-tested with a fake Supabase client. Both halves of the contract
have regression coverage in `tests/architecture/write-first-contract.test.ts`
and `tests/lib/in-progress-recovery.test.ts`.

The architecture test recognizes both direct `await supabase...insert()` calls
and delegated `await writeOrEnqueue('insert', ...)` calls as valid patterns.

### Why this matters

Fleet Garage uses switch-case routing in App.tsx. Every module switch fully
unmounts the previous component. React state dies on unmount. If a Supabase
write hasn't landed before unmount, recovery queries find nothing and the
session appears to reset. This is silent — no error, no toast, just a blank form.

### New features checklist

Adding a new quick-start, timer, or session feature?

- [ ] Does the start handler await the Supabase insert before setting state?
- [ ] Does the component have a mount recovery useEffect querying in_progress?
- [ ] Does the reset handler clear the pendingId?

---

## Payload Deduplication (`useDriverLiveTrip`)

`src/hooks/useDriverLiveTrip.ts` uses two extracted helpers to eliminate
repetition across the online/offline write paths:

- **`buildTripPayload(overrides)`** — single source of truth for the Supabase
  payload shape. Adding a new column means changing one place.
- **`writeOrEnqueue(action, payload, eqField?, eqValue?)`** — attempts a
  Supabase write; falls back to `enqueueOfflineAction` on network errors.
  Returns `{ ok: boolean }`.

Both `handleStart` and `handleArrived` delegate to these helpers.

---

## Context Architecture

State management is split into 4 domain-specific React contexts:

| Provider | Hook | Owns |
|----------|------|------|
| `VehicleHoldProvider` | `useVehicleHoldContext()` | vehicles, holds, staleHolds, write ops, realtime holds |
| `WashbayProvider` | `useWashbayContext()` | washbay logs, handoff notes, shift checkpoints, realtime |
| `IssueProvider` | `useIssueContext()` | facility issues CRUD |
| `LostFoundProvider` | `useLostFoundContext()` | lost & found items (plate matching via vehicles) |

### Provider tree (in `App.tsx`)

```
ScheduleProvider
  └─ VehicleHoldProvider
       └─ WashbayProvider
            └─ IssueProvider
                 └─ LostFoundProvider
                      └─ AppShell + Routes
```

`LostFoundProvider` depends on `VehicleHoldProvider` (for plate→vehicle
matching), so it must be nested inside it.

### `useGarage()` shim

`src/context/GarageContext.tsx` is a backward-compatible shim that merges
all 4 contexts into one object. Existing consumers import `useGarage()` and
work unchanged. **New code should import the domain-specific hook** for
narrower re-render scope.

Once all consumers are migrated to domain hooks, `GarageContext.tsx` can be
deleted.

### Slice hooks

Each domain provider wraps a "slice hook" that owns the state and mutations:

- `useVehicleOperations` — vehicle/hold write operations
- `useIssues` — facility issue CRUD
- `useWashbayHandoff` — washbay + handoff writes
- `useShiftCheckpoints` — shift checkpoint CRUD
- `useLostFound` — lost & found items

The slice hooks are pure state logic; the provider wrappers add data loading
and React context plumbing.

---

## Component Directory Structure

```
src/components/
├── analytics/       AnalyticsView, fleet balance, shift summary
├── audit/           AuditView, AuditForm
├── check-in/        CheckInView, hold panel, routing, selectors
├── dashboard/       HoldsView (main holds screen), summary cards, stale alerts
├── holds/           NewHoldForm, release, repair, damage presets
├── issue-log/       IssueLogView, card
├── layout/          Sidebar, AppShell
├── lost-and-found/  LostAndFoundView, card, list, modal
├── manifest/        ManifestView (outbound manifest)
├── movement/        MovementLogView, TripStartForm, DriverLiveForm, trips
├── my-shift/        MyShiftView, approvals, export
├── off-standard/    OffStandardTimeLog, OffStd* sheets
├── shared/          Toast, scanner, photo, modals, whiteboard
├── vehicle/         VehicleHistory, RegisterVehicleForm, FleetMasterView
└── washbay/         Closing log, live section, handoff
```

Each subdirectory has a barrel `index.ts`. Lazy imports in `App.tsx` point
directly to subdirectory files (e.g. `./components/holds/NewHoldForm`).

### Naming conventions

- **`*View`** — top-level screen component (rendered by App.tsx switch)
- **`*Form`** — data-entry screen or modal
- **`*Screen`** — external/standalone screen (e.g. ScheduleScreen, LoginScreen)
- Module IDs match their sidebar label: `holds`, `check-in`, `analytics`, etc.

---

## User Resolution (Profiles vs. USERS Mock)

To display "who flagged this hold" / "who logged this shift" etc., resolve
the id through `useUserResolver` — NOT through the `USERS` mock import.

**Why:** the legacy `USERS` mock is keyed on mock ids (`'u1'`, `'u2'`...).
Real Supabase auth UUIDs never match, so direct USERS lookups produce
"Unknown" for every production user. This was the original defect that
migration 056 worked around by denormalizing the flagger's name at write
time; migration 057 retires that workaround.

### The resolver

`useUserResolver()` returns `{ getName, getRole, getEmpId, getProfile }`.
Each lookup tries three sources in order:

1. **Live profiles** (from the `profiles` table, loaded via `ProfilesProvider`)
2. **Legacy USERS mock** (only matches mock-id rows, kept as a transition)
3. **Snapshot fallback** (the denorm column, when caller supplies it)

```tsx
const { getName } = useUserResolver();
// Profiles win; denorm only matters for historical rows where the profile
// no longer exists (e.g. user deleted from auth).
<span>{getName(hold.flaggedById, hold.flaggedByName)}</span>
```

The resolver is a pure factory (`createUserResolver` in `src/lib/`) so it
is unit-tested without React. See `tests/lib/user-resolver.test.ts`.

### Listing team members

`useTeamMembers()` returns the deduped union of live profiles and the
USERS mock (profiles win on id collision) — use this when a feature needs
to ITERATE rather than look up. Schedule grid, driver-coverage analytics,
recipient pickers. The merge logic is pure (`mergeTeamMembers`) and tested
in `tests/lib/user-resolver.test.ts`.

### USERS mock — permanent dual-tier identity

Fleet Garage runs one real branch (YWG) plus several demo-theatre branches
(YVR, YYC, etc.) used to show off the app. Real-branch users authenticate
through Supabase and live in `profiles`. Demo-theatre users are not real
people — they exist only as fixture data in `data/mock.ts`, with mock ids
like `'u1'`, `'u2'`...

The two-source resolver (`profiles` first, `USERS` as fallback) is not a
transition state. It is the architecture: one tier per user population.
Deleting the `USERS` fallback would break attribution, schedule grids, and
driver-coverage analytics on the demo branches.

After the Phase B + Phase C sweep, `USERS` is imported by exactly two
files: `src/hooks/useUserResolver.ts` and `src/hooks/useTeamMembers.ts`.
Both consume it as the second tier. Every other consumer goes through the
hooks. **Do not import `USERS` directly anywhere else** — adding a new
direct import re-creates the migration-056 class of bug (real-branch UUIDs
falling through to "Unknown" because USERS only knows mock ids).

### Real-branch sanity signal

The fallback is expected to fire for demo-theatre sessions. It should
**not** fire for a logged-in real-branch session — if it does, that's a
genuine "Unknown user" bug (a real auth UUID with no matching profile).
To detect this empirically, instrument the fallback inside
`createUserResolver`:

```ts
if (mock) {
  // Real-branch fallback is a bug; demo-branch fallback is expected.
  if (currentBranchId === 'YWG') {
    console.warn(`[user-resolver] real-branch fallback id=${id}`);
  }
  return { /* ... */ };
}
```

A clean log on the real branch is the steady-state we want. Demo-branch
warnings, if any, are noise to ignore (or filter out at the logger level).

### Guard against drift

Two things would re-introduce attribution bugs:

1. **A new direct `USERS` import** somewhere outside the two resolver
   hooks. Periodic check:
   `grep -rn "from '.*/data/mock'" src/ --include='*.ts*'` — should only
   match the two hook files.
2. **A new write that hard-codes a mock id** instead of using
   `user.id` from `useAuth()`. Periodic check:
   `grep -rn "'u[0-9]" src/ --include='*.ts*'` — should only match
   `data/mock.ts` itself.
