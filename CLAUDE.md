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

### A role gate on a personal affordance is a bug (three found 2026-08-17)

Aaron's role is **`VSA`**. `canRelease()` and `isManagement()` are **false** for him. So any
`{isManagement && …}` wrapper is, in practice, **`{false && …}`** — it deletes the feature for
the only person using the app. This has now bitten four times:

| Where | What it hid | Verdict |
|---|---|---|
| `EffieCreditPanel` | his own API bill | wrong ROOM → moved (`d460412`) |
| `HoldsVehicleRow` | the 📌 pin on his own holds board | wrong GATE → removed |
| `ScheduleScreen` | closing-hours readout (peak season) | wrong SCOPE → readout freed, toggle kept |
| `TripList` | long-trip flag — `isManagement={false}` at **both** call sites | dead in the app entirely |

**Before adding or keeping a role gate, ask which of three it is:**

1. **An authority action** — releasing a damaged car on exception, approving a request,
   flipping a branch-wide default. **Keep the gate.** (`PendingApprovalsSection` and the
   peak-season *toggle* are correct as-is.)
2. **A personal affordance** — pinning, filtering, a readout about the reader's own work.
   **No gate.** Wiring a convenience to an authority check is the recurring mistake.
3. **Mixed** — a readout bundled with a control. **Split it**, don't open the gate wholesale.

And the deeper pattern, which fired **three times in one week**: FG carries assumptions from
the multi-operator org that never adopted it. Besides role gates, watch for **two-person
handoffs** — the fuel closing→opening relay (`ea1aa0d`) assumed an opener and a closer, and
the class codex (`282d190`) could only learn during registration. **When a feature silently
does nothing, ask whether it is waiting for a second person who does not exist.**

### Domain Enum Protocol — ground the live distribution before you filter on it

Shipped 2026-08-16: `scanHoldLines` filtered `status === 'ACTIVE'`. An out-on-exception hold is
**`RELEASED`** — releasing it is what let the car go out — so the filter excluded the exact case
the request opened with. Live distribution: **9 ACTIVE against 199 RELEASED, of 422**. Four
checks agreed with me and all four were circular: I wrote the filter, I wrote the fixture, I
wrote a highlight for a state the filter made unreachable, and I render-verified on a car I chose
*because* it matched the filter.

**So, when writing or narrowing a filter over a status/enum column:**

1. **Query the live distribution first** (Management API, one statement). A branch matching 2% of
   rows is a finding, not a detail.
2. **Write down which values are IN and which are OUT, and why** — in the code, next to the
   filter. `scanHoldSummary.ts` is the reference.
3. **Never verify on a fixture you chose.** Verify on the case the *operator* described, in
   their words. If the fix erased every real instance, manufacture one — and then **check the
   durable side effect (the row), not the visible one (the toast)**.

## The 330-Line Cap

**All logic files (`src/components`, `src/hooks`, `src/context`, `src/lib`, and
the `api/` serverless functions + their `api/_lib`) stay under 330 lines.**

This is enforced by ESLint (`max-lines`, counting code lines — blank lines and
comments are skipped). The gate covers `src/**/*.{ts,tsx}` **and `api/**/*.ts`**
(the latter added 2026-08-03, `ticket-api-line-gate` — `fg-chat.ts` had crept to
336 with nothing watching the API layer). The limit exists because FG grew as a proof-of-concept
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
`tests/lib/fleet-master.test.ts`). Lib coverage is strong — 120 of 129 `src/lib`
modules are tested; the remaining 9 gaps are all IO/glue (`addPersonalEvent`,
`addWhiteboardReminder`, `airportFlipSync`, `audit-export`, `effieThreadSync`, `hold-export`, `image`, `supabase`, `vsaTripWrite`). When a new pure function
lands in `src/lib/`, add its test under `tests/lib/` in the same commit.
*(A 2026-06-20 line-check caught ~10 pure modules that had trickled in test-less
while this count drifted from 47 → 70 — the rule slips one commit at a time, so
the count above is the canary: if it stops matching
`find src/lib -name '*.ts' ! -name '*.test.ts' | wc -l`, pure logic is going
untested.)*

**Blind spot (narrowed 2026-08-03): the `max-lines` *size* gate now covers `api/`
too — but the test-coverage *canary* still only watches `src/lib`. So pure logic
in `api/_lib` (and inline in `api/*.ts`) is size-capped but still slips test-less
silently.** Rule of
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

**2026-07-20 — the gate is silent at the SDK boundary. `scripts/verify-schedule-vision.ts`
exists because of this.** Two defects shipped in one day on `api/fg-schedule-parse.ts`, both
gate-green, both found by Aaron on the lot:

- `max_tokens` 8192 → 32000 crossed a **client-side SDK guard** (`3600 * max_tokens / 128000
  > 600` ⇒ anything over **21,333** throws *"Streaming is required…"* **before the request is
  sent**). Fix: `.stream(...).finalMessage()`, never `.create()`, above that line.
- The timeout meant to bound it was set in the **per-request** options; the guard reads the
  **client constructor's** timeout (`this._client._options.timeout`). Wrong object, no effect.

**Neither was FG logic — both were the library contract, and the suite only covers code we
wrote, not code we call.** 1,747 passing tests, zero touching the one line that broke; the size
of that number actively created false confidence. **So: any change to a model request's shape
(model, `max_tokens`, streaming mode, timeout placement, tool schema) is unverifiable by the
gate and must be sent for real before it's called done** — `npx tsx scripts/verify-schedule-vision.ts
<sheet>` (manual by design; it costs tokens, so it's out of `gate.sh` and the pre-push hook).
The request lives in `api/_lib/scheduleVisionRequest.ts` so its shape is at least unit-testable,
including the coupling that broke (`SCHEDULE_MAX_TOKENS > SDK_NONSTREAMING_MAX_TOKENS` ⇒ must
stream). **Read `node_modules/@anthropic-ai/sdk/client.js` when an SDK call misbehaves** — both
bugs were obvious in 30 seconds there, after hours of reasoning around them.

Two meta-lessons worth keeping: **(1) sweep a newly-learned constraint BACKWARDS over code you
already shipped, not just forward into what you're writing** — the "use streaming for large
`max_tokens`" guidance was in the API docs read that same session, applied to the new code, and
never checked against the `max_tokens` shipped an hour earlier. **(2) A correct diagnosis is not
a verified fix.** The truncation estimate (10.5–11k) was right — actual `output_tokens` measured
**11,433** — and being right about the *cause* is exactly what supplied the confidence to ship
the *fix* twice without proving it.

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

## Routed props — derive or re-seed, never seed-once

A prop that arrives across a module boundary (a `Screen` prop from `navigate`, a context
value, an event payload) must be **derived from the prop each render**, or **explicitly
re-seeded when it changes**. Never `useState(theProp)` and walk away: `useState` reads its
argument **only at mount**, and navigating to a screen you are *already on* re-renders the
same mounted component — React never remounts, so the new value is silently discarded and
the button looks dead.

**The safe shape** is derivation (`useVehicleHistory(vehicleId)` recomputes every render, so
it cannot go stale). **The unsafe shape** is capture. When you genuinely need editable local
state seeded from a prop, pair the seed with a render-time re-seed — *not* a `useEffect`,
which this repo lints (`react-hooks/set-state-in-effect`) and which costs an extra render
pass with a visible flash:

```ts
const [last, setLast] = useState(prop);
if (prop && prop !== last) { setLast(prop); setLocal(prop); }   // truthy-guard: never blank typed input
```

**Why this rule exists (2026-07-19, `9d1535f` + `e86441b`):** `scanRouterActions` documented
itself as routing "to the module pre-filled." **Five of its six destinations dropped the
payload** — Start trip, Flag/hold, Log lost & found, Register, Register & flag. Only *View
Unit* was safe, because it derives. Two were data-integrity bugs, not cosmetic: a stale
`selectedVehicleId` could put a hold on the **previously scanned car**, and six captured
identity fields could register a vehicle under the **previous car's** unit#, make, model and
year. Every file passed tsc, eslint and 1706 tests — the defect lived only in the *seam*.
**Any new scan/route destination inherits this trap; check it before wiring one up.**

**The sharper trap — a re-seed keyed on VALUE no-ops on a REPEAT (2026-07-21).** The re-seed
above (`prop !== last`) fires once per distinct *value*. That's correct when the prop is a value
to mirror — but a **scan is an EVENT**, and re-scanning the same tag produces an identical string.
So the value-keyed re-seed fired on the first scan and silently no-opped the second: Aaron scanned
LZM531 → Start trip → filled; reset; scanned LZM531 again → empty field (`handleReset` cleared the
field but not the hook's `last`, desyncing them). Register never hit it — it routes a fresh
`scanned` OBJECT (new identity per scan). The fix: a per-scan **`prefillNonce`** on the `Screen`
(monotonic module counter in `ScanRouterOverlay`, NOT per-mount — the overlay unmounts on close),
and the destination re-seeds keyed on the nonce, not the plate: `useRoutedProp(nonce, () =>
setLocal(plate))`. **Rule: if a routed prop is a discrete event (a scan, a "log this now"), key its
re-seed on a per-event nonce, not the payload value — or a repeat of the same payload dies silently.**
*A value-keyed re-seed PASSES the seed-once grep and looks swept while still no-opping the repeat —
the cross-module line-check station must ask not just "is there a re-seed?" but "does it fire on a
REPEAT of the same value?"* (the R46 line-check cleared this seam on the first question and missed
the second.)

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
                     # exits clean, missing real errors. -b follows the references
                     # (src, api, node, AND tests/ as of tsconfig.test.json, 2026-07-22 —
                     # a broken test fixture used to be invisible to this gate entirely).
npx eslint .         # lint — enforces the line cap (0 errors, 0 warnings expected)
npx vitest run       # tests
npm run dev          # dev server
```

### `docs/` is gitignored — it never ships

The `docs/` folder (tickets, specs, the ideas inbox) is entirely gitignored. It's a real,
useful working convention — but a commit message must never say a ticket file "ships with"
or "is part of" a commit, because `git add -A` silently drops it and `git status` shows
nothing. (Caught R48, 2026-07-22: two commit messages referenced
`docs/ticket-keytag-field-provenance.md` as shipped; it was never tracked, in any commit.)
If a ticket needs to be durable/shared, that's a signal it belongs in a memory file or this
CLAUDE.md, not an assumption that `docs/` persists to the remote.

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
`.verify/<name>.png` for the Read tool. Paths: `/`, `/my-day`, `/schedule`,
`/shift` (alias `/my-shift`), `/lost-and-found`, `/movement-log`, `/audits`,
`/analytics`, `/issue-log`, `/manifest`, `/fleet`, `/effie` — the full map is
`src/lib/screenRouting.ts`. An UNMAPPED path never errors: the app silently
falls back to the last-visited module, which reads as "wrong screen rendered"
(bit 2026-07-16 — `/my-shift` pre-alias rendered My Day and got read as a
landing-pref bug). This is the standing cure for "shipped visual work unseen."
**⚠️ The helper renders at 1280px DESKTOP + LIGHT mode only** (`verify-fg.mjs` hardcodes
`viewport 1280×900`, no theme). So it **cannot see** two whole classes of change: the
`md:hidden` **mobile header** (`AppShell.tsx` — invisible above the `md` breakpoint) and
**dark mode** (class-based, not `prefers-color-scheme`, so Playwright's `colorScheme:'dark'`
does nothing). For a mobile-only or dark change, a plain helper run "verifies" a ghost —
render a **custom viewport** (e.g. 390px) and **force the class** (`page.evaluate(() =>
document.documentElement.classList.add('dark'))`), and drive **both themes + the tightest
layout state in one pass**. Bit the header mis-tap fix `619fade` (2026-08-11): the fix lived
in the `md:hidden` header, so the desktop-light helper would have shown nothing.

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
