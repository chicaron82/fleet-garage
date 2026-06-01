# Fleet Garage — Claude Code Instructions

## The 330-Line Cap

**All logic files (`src/components`, `src/hooks`, `src/context`, `src/lib`) stay under 330 lines.**

This is enforced by ESLint (`max-lines`, counting code lines — blank lines and
comments are skipped). The limit exists because FG grew as a proof-of-concept
without a size guardrail and started accumulating god-components; it is now
load-bearing, so the cap keeps complexity from hiding in 500-line files.

- **New files must pass the cap — it is an `error`.**
- File headers and doc comments are free (comments don't count). Business logic is what's capped.
- If you're approaching 330, the answer is almost always extraction, not deletion of documentation.

### Exemptions

`src/types/**` and `src/data/**` are exempt — they're type declarations and
static/mock data, not logic. (`database.types.ts` is generated.)

## When You Approach the Cap

Don't cram. Extract, following patterns already in the codebase:

1. **State + side effects → a hook** in `src/hooks/` or `src/context/`.
   Good examples: `useVehicleOperations` (all vehicle/hold writes), the
   `useOffStandard*` family (`useOffStandardSession`, `useOffStandardTimer`, …),
   `useDriverLiveTrip`.
2. **Pure logic → a lib** in `src/lib/`, separated from I/O.
   Gold standard: `lib/fleet-master.ts` — `buildFleetView` is a pure function,
   `loadFleet` does the fetching and delegates to it. `lib/vehicle-status.ts` is
   the shared status cascade both read and write paths feed through.
3. **A big component → section subcomponents.** Split a long form/view into the
   logical sections it already renders, each its own file.

The component that survives is a thin composition: it calls hooks, renders
sections, and wires them together — it doesn't implement them.

## Grandfathered Debt

13 files predate the cap. They're listed in `eslint.config.js` as **warnings**
(not errors), so the build stays green while keeping each one visible. That list
is the burn-down backlog — refactor toward 330 and **delete each path from the
list as it drops under**. Do not add new entries; new files take the error cap.

Worst offenders to tackle first: `CheckInIntakeForm.tsx` (455),
`NewHoldForm.tsx` (443), `TripStartForm.tsx` (436), `HoldsView.tsx` (424),
`ReleaseForm.tsx` (412) — all dense forms/views that split cleanly into sections.

## Tests

Tests live in the top-level **`tests/`** tree, mirroring `src/` (e.g.
`tests/lib/fleet-master.test.ts`). Lib coverage is strong — 34 of 38 `src/lib`
modules are tested; the only gaps are IO/glue (`audit-export`, `demo-accounts`,
`image`, `supabase`). When a new pure function lands in `src/lib/`, add its test
under `tests/lib/` in the same commit.

> Convention note: 6 libs also have a `*.test.ts` co-located in `src/lib/`
> (`garage-mappers`, `gas-sheet`, `holdFilters`, `ot`, `ptoRequest`, `stats`) —
> a pre-existing split with `tests/lib/`. New tests go in `tests/`; consolidating
> the stragglers is a separate cleanup.

## Build & Test

```bash
npx tsc --noEmit     # type check
npx eslint src/      # lint — enforces the line cap (0 errors expected; 13 grandfathered warnings)
npx vitest run       # tests
npm run dev          # dev server
```

## Stack

- React + TypeScript (strict) + Vite + Tailwind
- Supabase (Postgres + auth + storage); migrations live in top-level `migrations/` (058+), **not** `supabase/migrations/`
- PWA (no OAuth redirects)
