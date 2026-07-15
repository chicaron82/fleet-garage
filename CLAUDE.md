# Fleet Garage — Claude Code Instructions

## Personal-first — one operator, deep (2026-07-01)

FG is **Aaron's personal tool**, not a shared platform — he is the sole active operator,
and going forward we build **depth for him**, not breadth for many users. Key distinction:
FG runs a **multi-person operation** (the whole crew's schedule, the fleet, the airport
queue) but has **one operator** (Aaron).

- **Build for the single operator's depth.** Effie + the UI may assume Aaron's context
  (YWG, his role, his habits), personalise to him, and surface proactively (a "My Day"
  cockpit is the flagship next move). The recall→knowing thesis turned *inward*: FG
  knowing *him*, not just the operation.
- **Keep the crew/fleet DATA multi-entity** — you still manage a team; don't collapse the
  schedule/fleet to single-entity.
- **Keep the substrate** — auth, RLS, roles, schema all stay (the "if another live account
  activates" insurance). Wire a second operator's UX **then**, not now.
- **Discipline is unchanged — personal ≠ hacky.** Everything below still applies; "clean
  code IS fast code." Build new/shape-unknown ideas in **two passes** (pass 1: works +
  green + rough-shaped; pass 2: extract/split/name/dedupe into proper order) — both green.

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
`tests/lib/fleet-master.test.ts`). Lib coverage is strong — 95 of 102 `src/lib`
modules are tested; the remaining 7 gaps are all IO/glue (`addWhiteboardReminder`,
`audit-export`, `effieThreadSync`, `hold-export`, `image`, `supabase`, `vsaTripWrite`). When a new pure function
lands in `src/lib/`, add its test under `tests/lib/` in the same commit.
*(A 2026-06-20 line-check caught ~10 pure modules that had trickled in test-less
while this count drifted from 47 → 70 — the rule slips one commit at a time, so
the count above is the canary: if it stops matching
`find src/lib -name '*.ts' ! -name '*.test.ts' | wc -l`, pure logic is going
untested.)*

**Blind spot: the canary only watches `src/lib`. Pure logic in `api/_lib` (and
inline in `api/*.ts`) is NOT counted** — so it slips test-less silently. Rule of
thumb: if a piece of logic is subtle enough that you *hand-verify* it (a shift-day
cutover, a plate-prefix snap, a dedup key), it's subtle enough to deserve a test —
extract it to `api/_lib` and test it under `tests/api/_lib/`. R35 caught
`shiftBusinessDate` inline+untested in `fg-chat.ts` this way (the h23/h24 midnight
footgun was verified by hand, then pinned in a test).

## Effie behavior bugs: a deterministic guardrail beats another prompt rule

When Effie misbehaves (emits `**markdown**`, narrates "drafted" without calling the
tool, mislabels a keytag as damage, mis-snaps a plate), the reflex is to add a prompt
rule. **Prompts are hope; code is a guarantee** — the model is non-deterministic (R36:
the register card rendered on PC but not phone, *same build*, because she called the
tool one time and narrated it the next). The durable fixes of 2026-07-05 were all
deterministic backstops, not prompt rules: `stripForSpeech` (markdown gone from TTS +
display no matter what she emits), `correctManitobaPrefix` wired into `resolveVehicleRow`
(a misread plate resolves regardless), the typed-`confirm` fallback (a pending proposal
fires even if the card never renders). The prompt-only fixes (plain-text instruction,
the "don't narrate an action" leash) FAILED or are unverifiable. **So: reach for a
deterministic guardrail FIRST; if a fix can only be a prompt, call it mitigation, not a
fix, and pair it with a code backstop.** Never claim a prompt-only change is "fixed."

**2026-07-06 continuation:** the vision-draft backstop (`269d9a4`) is the same move — if a
turn ends *claiming* a draft ("Drafted below") but no `propose_*` tool fired, the loop
injects one recovery instruction forcing the call (validated 8/8 by seeding the flaked
state). Two sharper verify lessons from that day:

- **Validate the path the operator ACTUALLY uses — not an adjacent one.** Effie runs TWO
  model paths: **text → Sonnet**, **image → Opus** (`VISION_MODEL`). The Tesla-asset feature
  was "validated on Sonnet" (a *text* register) and shipped — then broke live on the real
  path (a keytag *photo* → Opus vision narrated the draft without calling the tool). For
  anything photo-driven, the validation must exercise the **Opus vision turn**, not a text
  proxy. An adjacent-path pass is not a validation, and "validated" in a commit means the
  real path or it's a lie.
- **Post-deploy verify = hard-refresh FIRST.** FG is a PWA; its service worker serves cached
  chunks until a hard refresh, so a fresh deploy can render OLD behavior even with the new
  footer commit (bit twice 2026-07-06 — the Tesla card and the "via Effie" marker both read
  as "missing" until Aaron cleared storage; the code was correct and in the shipped bundle
  the whole time). Every "here's what to verify" instruction after a deploy must open with
  hard-refresh / clear-storage, or you'll debug a ghost.

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

## Dev/prod header parity — a prod-only trap

`vite.config.ts` `server.headers` (dev) and `vercel.json` `headers` (prod) are
**separate and don't inherit.** A feature depending on a response header can work
in `npm run dev` and be silently dead in prod. This bit Effie's voice: the COOP/COEP
isolation headers `SharedArrayBuffer` (Kokoro) needs were added to `vite.config` on
June 27 but never to `vercel.json` — so `crossOriginIsolated` was `false` on
`fleet-garage.vercel.app` and the voice failed silently for 4 days until someone
tested speech on the *deployed* site (`c5dc30d` added the prod header as
`credentialless`). When you add a header for a feature, add it to **both**, and
verify on the deploy — `curl -sI https://fleet-garage.vercel.app` + a fresh-browser
(no-SW) load evaluating the runtime effect. The authed-verify helper renders **dev**
and will **not** catch a prod-only header gap. (PWA caveat: the SW caches the shell,
so a returning client serves the old headers until the SW updates — hard-refresh to
verify now.)

## Stack

- React + TypeScript (strict) + Vite + Tailwind
- Supabase (Postgres + auth + storage); migrations live in top-level `migrations/` (058+), **not** `supabase/migrations/`
- PWA (no OAuth redirects)
