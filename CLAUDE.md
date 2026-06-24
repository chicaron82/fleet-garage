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
`tests/lib/fleet-master.test.ts`). Lib coverage is strong — 68 of 74 `src/lib`
modules are tested; the remaining 6 gaps are all IO/glue (`audit-export`,
`hold-export`, `image`, `quickStartPrefs`, `supabase`,
`vsaTripWrite`). When a new pure function lands in `src/lib/`, add its test
under `tests/lib/` in the same commit. *(A 2026-06-20 line-check caught ~10 pure
modules that had trickled in test-less while this count drifted from 47 → 70 — the
rule slips one commit at a time, so the count above is the canary: if it stops
matching `find src/lib -name '*.ts' | wc -l`, pure logic is going untested.)*

> Convention note: lib tests now live **only** under `tests/`, mirroring `src/` —
> the 6 stragglers that were co-located in `src/lib/` were consolidated 2026-06-01
> (`gas-sheet` + `garage-mappers` were merges — each `src/lib` copy covered cases
> the `tests/lib` copy didn't, so they were unioned, not moved). Three more drifted
> back in and were re-consolidated 2026-06-08: `shift-metrics` (unioned — its
> `fleeting_sent`/carry-over/`sentToFleet`-seam cases were unique), `washbay-throughput`
> and `types/index` (clean moves). Keep all new tests in `tests/` — this rule has
> needed re-enforcing twice now, so don't co-locate "just this one."

## Writing data — the submit lock

Insert-shaped writes (anything that mints a fresh row id) go through
`withSubmitLock(key, fn)` from `src/lib/submitLock.ts`, applied **inside the context
write function** (`addHold`, `addRelease`, `createShift`, `bulkCreateShifts`,
`addIssue`, …) — never re-derived per-form. A React `submitting` state / `disabled`
button flips on the *next* render, so two taps in the same frame both pass and you get
a duplicate row (each insert mints its own UUID, so nothing collides); the synchronous
`Set`-check in `withSubmitLock` closes that window. **State flags are for
spinners/`disabled` only — never the lock.** Key on the logical target
(`hold:${vehicleId}`, `release:${holdId}`, `shift:${userId}:${date}:${type}`). A new
insert form inherits protection by routing through a guarded write fn. Updates and
keyed upserts converge harmlessly and don't need it. *(This lesson recurred three
times — `useState(async)` sweep, the `addHold` shared guard, the app-wide sweep — each
time the fix was "move it to where paths converge.")*

## Design Language — One Header, One Action, One Accent

Every module wears the same header and exposes one create-action, so neither
drifts. This is **encoded in two shared components, not just documented** — the
encoding is what makes it hold.

- **`<ModuleHeader title subtitle action />`** (`src/components/shared/`) is the
  one header: bold title, optional gray subtitle, optional top-right `action`
  slot. Use it for every module — don't hand-roll an `<h1>`. The markup had
  already drifted before this consolidated it (Schedule shrank to `text-lg`;
  headers split on `items-center` vs `items-start`).
- **`<PrimaryAction label onClick />`** is the one create-action: a solid yellow
  `+ {label}` pill with baked-in haptics. **Placement:** if the module has a
  search/filter, the pill pairs with it on one row — input left, button right
  (`<div className="flex gap-2">[input flex-1][PrimaryAction]</div>`), co-locating
  "search → not found → add"; otherwise it sits in the ModuleHeader action slot.
  Either way it's the same pill, so every "add a record" reads and behaves the
  same — search-row actions, header actions, and empty-state register CTAs alike.
  (Holds takes it further: the search-row button is `Scan Barcode` until a search
  matches nothing, then it becomes `+ Add to ledger & flag`.)
- **Share is one lane (amber), one behaviour, three encodings.** The
  share-as-text dance — native share sheet → clipboard → `✓ Copied` — lives in
  **`useShareText()`** (`src/hooks/`); nothing re-rolls it. The inline affordance is
  **`<ShareAction build compact? label? />`**: an amber `↗ Share` link (glyph-only
  `↗` when `compact`) whose `build` thunk is deferred so a heavy log isn't assembled
  every render; haptics + `stopPropagation` are baked in (safe on a clickable card).
  The export sheets (PTO, Off-Standard, Shift Report) keep their format pickers but
  their text option is **`<ShareTextButton>`** — the amber block sibling
  (`↗ Plain Text`, `✓ Copied`, optional `loading`) beside a dark PDF button. It's a
  component, not a copied className, so the lane is enforced by existence. It had
  drifted badly — three cards (glyph vs label, gray vs amber) + four export buttons
  each re-rolling the fallback — before this consolidated it.
  `tests/hooks/useShareText.test.ts`, `tests/components/ShareAction.test.tsx`, and
  `tests/components/ShareTextButton.test.tsx` guard the contract.

**Colour lanes — never cross them.** Action = `fg-yellow` (the accent: PrimaryAction,
focus rings). Status = red / green / amber (urgency, success, state). Share = amber
(`ShareAction` only — its own affordance, not a status). A red "add" button reads as
a warning; a yellow status dot reads as a control. Keep them apart.

**The accent is a token.** Action surfaces use `bg-fg-yellow` /
`hover:bg-fg-yellow-hi` (`--color-fg-yellow` #facc15 / `-hi` #eab308 in
`index.css`), darken-on-hover. The whole action surface (bg/border/ring) derives
from it — change the brand action colour in one place. Don't reintroduce raw
`bg-yellow-400`; `tests/components/ModuleHeader.test.tsx` guards PrimaryAction
against it. *Not yet tokenised (a later palette pass): readable text-yellow links
(yellow-600/700), soft-tint panels (yellow-50/100/900), native form accent
(accent-yellow). Those are a separate lane for now.*

**Dashed = empty states**, not persistent actions. The dashed-ghost treatment is
the "nothing here yet" placeholder; the persistent create-action is the header pill.

## Build & Test

```bash
# Run all gates from the repo root (structural — no ambient-cwd risk):
bash /home/ronnie/Kitchen/fleet-garage/scripts/gate.sh

# Or individually:
npx tsc -b           # type check — use -b, NOT --noEmit. The root tsconfig is a
                     # solution file (`files: []`); --noEmit checks zero files and
                     # exits clean, missing real errors. -b follows the references.
npx eslint .         # lint — enforces the line cap (0 errors, 0 warnings expected)
npx vitest run       # tests
npm run dev          # dev server
```

### Visual changes — pre-ship checklist

`tsc`/`eslint`/`vitest` are blind to layout. Before committing any visual change:

- [ ] Dark mode: toggle and spot-check affected surfaces
- [ ] Mobile width (≤375px): no overflow, no cramped labels
- [ ] Alignment: header title and action slot stay on the same baseline
- [ ] Color: action buttons are `bg-fg-yellow`, not raw `yellow-400` or any other tone
- [ ] **Actually look at it** — don't ship visual work pixel-unseen (see below)

**Authed-verify helper — render an authed screen and screenshot it.** With the
dev server up, `node scripts/verify-fg.mjs <path> <name> [clickText]` logs in as
the verify bot (creds in gitignored `.env.local`: `VERIFY_EMPLOYEE_ID` /
`VERIFY_PASSWORD`; the `DIZEE` / GM account), caches the session in `.verify/`
(gitignored), optionally clicks `clickText`, and screenshots `<path>` to
`.verify/<name>.png` for the Read tool. Paths: `/`, `/schedule`, `/shift`,
`/lost-and-found`, `/analytics`, `/issue-log`. This is the standing cure for
"shipped visual work unseen."

**Write boundary (DiZee is a mock account, scoped writes OK as of 2026-06-16):**
self-scoped writes are free — anything affecting only DiZee's own numbers
(off-standard, airport flips, own shift/closing logs). Vehicle/hold ops are OK
on **HRZ-prefixed mock vehicles only** (`src/data/mock.ts`), borrow-and-return
(clear/release what you create). Off-limits: real (non-HRZ) vehicles, other
crew's records, destructive ops on real data. Note frontline writes are
role-gated (`isVSA = 'VSA' || 'Lead VSA'`) — the bot's `profiles.role` is set
per the verification at hand.

## Stack

- React + TypeScript (strict) + Vite + Tailwind
- Supabase (Postgres + auth + storage); migrations live in top-level `migrations/` (058+), **not** `supabase/migrations/`
- PWA (no OAuth redirects)
