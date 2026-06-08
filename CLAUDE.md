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

## Grandfathered Debt — burned down (2026-05-31)

The 13-file grandfather list is **gone**. Every logic file in `src/` is now under
the 330-line cap, so the cap is a hard **error** across all of `src/` — there is
no longer a warning tier. The only carve-outs in `eslint.config.js` are the
`src/types/**` + `src/data/**` exemptions and one justified pure-renderer
(`src/components/analytics/ShiftReportPDFSections.tsx`, a flat list of dumb
@react-pdf sections). Do not add new exemptions; new files take the error cap.

## Tests

Tests live in the top-level **`tests/`** tree, mirroring `src/` (e.g.
`tests/lib/fleet-master.test.ts`). Lib coverage is strong — 41 of 47 `src/lib`
modules are tested; the remaining gaps are IO/glue and pure renderers
(`audit-export`, `demo-accounts`, `hold-export`, `image`, `supabase`,
`vsaTripWrite`). When a new pure function lands in `src/lib/`, add its test
under `tests/lib/` in the same commit.

> Convention note: lib tests now live **only** under `tests/`, mirroring `src/` —
> the 6 stragglers that were co-located in `src/lib/` were consolidated 2026-06-01
> (`gas-sheet` + `garage-mappers` were merges — each `src/lib` copy covered cases
> the `tests/lib` copy didn't, so they were unioned, not moved). Three more drifted
> back in and were re-consolidated 2026-06-08: `shift-metrics` (unioned — its
> `fleeting_sent`/carry-over/`sentToFleet`-seam cases were unique), `washbay-throughput`
> and `types/index` (clean moves). Keep all new tests in `tests/` — this rule has
> needed re-enforcing twice now, so don't co-locate "just this one."

## Build & Test

```bash
npx tsc -b           # type check — use -b, NOT --noEmit. The root tsconfig is a
                     # solution file (`files: []`); --noEmit checks zero files and
                     # exits clean, missing real errors. -b follows the references.
npx eslint .         # lint — enforces the line cap (0 errors, 0 warnings expected)
npx vitest run       # tests
npm run dev          # dev server
```

## Stack

- React + TypeScript (strict) + Vite + Tailwind
- Supabase (Postgres + auth + storage); migrations live in top-level `migrations/` (058+), **not** `supabase/migrations/`
- PWA (no OAuth redirects)
