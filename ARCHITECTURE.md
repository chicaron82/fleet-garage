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

### Domain hooks only (the `useGarage()` shim is gone)

There was once a `useGarage()` shim (`src/context/GarageContext.tsx`) that
merged all 4 contexts into one object for backward compatibility. Every
consumer has been migrated to the domain-specific hooks and the shim was
deleted. **Import the domain hook you need** (`useVehicleHoldContext`,
`useWashbayContext`, `useIssueContext`, `useLostFoundContext`) for the
narrowest re-render scope — there is no longer an all-in-one accessor.

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

## User Resolution

To display "who flagged this hold" / "who logged this shift" etc., resolve
the id through `useUserResolver` — never reach into raw profile data or a
mock directly.

### The resolver

`useUserResolver()` returns `{ getName, getRole, getEmpId, getProfile,
getByEmployeeId }`. Resolution is **single-tier**: the only lookup source is
the `profiles` map (the `profiles` table, loaded via `ProfilesProvider` and
exposed as `Map<id, Profile>` by `useProfiles()`).

```tsx
const { getName } = useUserResolver();
// Live profile wins; the snapshot is only used when the id misses.
<span>{getName(hold.flaggedById, hold.flaggedByName)}</span>
```

The optional second argument is a **denormalised snapshot fallback** — used
only when the id isn't in `profiles` (e.g. a historical row whose author was
later deleted from auth). `getName` returns `'Unknown'` when both the lookup
and the snapshot come up empty; `getRole`/`getEmpId` return `''`.

### Pure factory + tests

The lookup logic is a pure factory, `createUserResolver(profiles)` in
`src/lib/user-resolver.ts`. `useUserResolver` is a thin
`useMemo(() => createUserResolver(profiles), [profiles])` wrapper — it stays
reactive so display components re-render when profiles finish loading.

Because the factory takes a plain `Map` and touches no React or I/O, it is
unit-tested directly in `tests/lib/user-resolver.test.ts` (name/role/empId
resolution, snapshot fallback, empty-string snapshot, profile-wins-over-stale-
snapshot, and the empty-map case).

### Listing team members

For point lookups, use `useUserResolver`. When a feature needs to **list**
users (schedule grids, driver coverage, recipient pickers), use
`useTeamMembers()` — it returns `Array.from(profiles.values())`, i.e. every
live profile. Single source, no merge step.

### Historical note — the retired USERS dual-tier

Earlier versions ran a two-source resolver: live `profiles` first, then a
`USERS` mock (`data/mock.ts`) keyed on fake ids (`'u1'`…`'u17'`) as a second
tier. That existed because demo-theatre branches were seeded with fixture
users who had no real auth accounts. Migration 057 gave every user a real
Supabase account and migration 061 migrated the mock ids, after which the
`USERS` fallback was removed entirely. Both `useUserResolver` and
`useTeamMembers` are now single-tier over `profiles`; the old
`mergeTeamMembers` merge helper is gone. The `profiles` map is the single
source of truth for identity.
