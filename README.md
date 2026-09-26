# Fleet Garage

A fleet operations companion for a rental lot — damage and hold tracking, vehicle movement,
washbay throughput, crew scheduling, and an AI assistant, built around one operator's actual day.

**Live:** [fleet-garage.vercel.app](https://fleet-garage.vercel.app)

> **What FG is, honestly.** It began as a proof-of-concept aimed at company adoption; it isn't
> that any more. FG is a **personal tool with a single operator** — it models a multi-person
> operation (the whole crew's schedule, the fleet, the airport queue) but has exactly one user.
> Nothing depends on it: the manual clipboard-and-memory way still exists and still works. FG
> exists to remove *ambiguity* — to turn recall and guessing into knowing — not to replace a
> system of record. Read the capability list below as "wired and working," not as "in daily use
> by a team."

## Core Modules

Fleet Garage has evolved far beyond a simple damage ledger. It now encompasses the entire lifecycle of a vehicle on the lot:

### 1. Damage & Hold Ledger (The Core)
- **Flag Damage:** VSAs document exterior/interior damage, detail issues, and upload photos.
- **Track & Resolve:** Vehicles are grounded until management reviews them. Management can authorize repairs or release the vehicle "on exception" (renting as-is) with expected return dates.
- **Re-evaluations:** System automatically prompts for re-evaluations on returning exception vehicles to verify condition.

### 2. VSA Movement Log
- **Telemetry:** Live tracking of internal transport, washbay queue depth, and fuel levels.
- **Shuttle Integration:** Built-in two-way bound support for logging staff shuttle runs (configurable via Fleet Operations settings).
- **Taxonomy:** Reasons are mapped to true operational scenarios (*Routine Transport*, *Coverage Assist*, *Code Red*).

### 3. Check-In & Intake
- **Barcode Intake:** Real HID/camera barcode parsing (`src/lib/barcode.ts` — 12-digit Canadian fleet codes: `0` + 4-digit area + 7-digit unit), with manual entry as fallback.
- **Key-Tag Scanner:** Photograph a vehicle's key tag and Claude vision reads plate, unit number, class code, rental class, year and colour off it, then routes to the right module pre-filled — register, flag, start a trip, log lost & found. Unrecognised class codes teach a codex.
- **Exception Handling:** Automatically detects when a vehicle returning from an "exception release" requires immediate review.

### 7. Effie — the AI assistant
- **Chat + vision:** Text runs on Sonnet, images on Opus. Register a car, draft a hold, read a schedule sheet, or answer a question about the fleet, conversationally.
- **Deterministic backstops:** Guardrails are code, not prompt rules — speech is stripped of markdown, misread plates are corrected against the Manitoba prefix, and a turn that *claims* a draft without calling the tool is forced to call it.

### 4. My Shift

- **Shift Summary:** Personal throughput rate, cars cleaned in your shift window, and effort score adjusted for off-standard time.
- **Save Summary:** Snapshot your shift to the 7-day history — saving again updates rather than duplicating.
- **Team Today:** Management view showing all saved summaries for the branch in one screen.
- **Shift Duties:** Washbay closing log — cars in, cars cleaned, throughput rate, and pipeline breakdown.

### 5. Staff Scheduling
- **Shift Management:** Weekly crew scheduling with role-based assignments.
- **Overrides:** Management can override standard templates for exceptions or coverage adjustments.

### 6. Analytics & Dashboards
- **Paginated Dashboards:** Clean, responsive client-side pagination for tracking active exceptions and holds.
- **Real-Time Dashboards:** Real-time data visualization of fleet health, hold turn-around times, and staff productivity.

## Roles & Permissions

| Role | Core Function | Can Release / Repair |
|------|---------------|---------------------|
| **VSA / Lead VSA** | Log movements, check in vehicles, flag damage | No |
| **CSR / HIR** | View inventory, log lost & found | No |
| **Branch Manager** | Full operational control, override settings | Yes |
| **Operations Manager** | Full operational control, override settings | Yes |

*(Also defined: `Driver`, `CSR`, `HIR`, `AGM`, `GM`, `City Manager`.)*

**How roles are actually used.** Only one account is active, and it is a `VSA`. The role map in
`src/lib/navigation.ts` therefore functions as a **scope** control rather than a permission one:
it keeps the operator out of modules built on data FG doesn't have (fleet balance, turnaround,
driver coverage — the HIR/counter side), which would otherwise render empty or misleading. Those
modules are wired and working; activating another account is all they need. **The role checks are
not a security boundary** — see the RLS note below.

## Tech Stack

- **Frontend:** React 19 + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4 (with full Dark Mode support)
- **State:** React Context API — domain-split providers (`VehicleHoldContext`, `WashbayContext`, `IssueContext`, `LostFoundContext`, `FleetBalanceContext`) plus `AuthContext`, `ProfilesContext`, `PreferencesContext`, `ScheduleContext`, `ActiveSessionsContext`, `PendingWritesContext`, `ScanRouterContext`, `EffieContext`
- **Backend (BaaS):** Supabase (PostgreSQL + Row Level Security + Storage)
- **Deployment:** Vercel

## Running Locally

```bash
npm install
npm run dev
```

Requires a `.env` file connected to your Supabase instance:

```env
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Build & Lint

```bash
npm run build    # tsc -b && vite build
npm run lint     # eslint
```

## Architecture Notes
- **Performance:** Client-side pagination prevents DOM bloat on massive lot inventories.
- **Preferences:** Robust user preference context for persisting UI settings (e.g., Dark Mode, Default Tabs, Notification preferences).
- **Offline:** Ships as a PWA — `vite-plugin-pwa` with a Workbox service worker (`registerType: 'prompt'`, so the app never silently swaps under you). Note the flip side: the service worker serves cached chunks after a deploy, so **hard-refresh before verifying new behaviour** or you'll debug a ghost.
- **Authentication:** Supabase Auth with employee ID login — a fake internal email is constructed under the hood before `signInWithPassword`. Sessions are JWT-based. The `profiles` table (migration 054) links auth UUIDs to employee ID, name, role, and branch.
- **Writes converge on a submit lock.** Insert-shaped writes go through `withSubmitLock(key, fn)` *inside* the context write function, never a React `submitting` flag — a state flag flips on the next render, so two taps in the same frame both pass and mint two rows.

### ⚠️ RLS is posture, not a lockdown — read this before trusting it

Every table has Row Level Security **enabled**, and **49 of the 61 policies in
`migrations/schema.sql` are `USING (true)`** — allow-all. Of the remaining 12, none are
meaningful access control either: four scope `profiles` rows, and eight simply bind a policy to
a storage bucket. Combined with an anon key that ships in the client, RLS here provides **no
protection against a determined reader or writer.** It is deliberate: FG is a trusted-crew tool
with one user, and the allow-all posture exists to match Supabase's expected shape and silence
the `rls_disabled_in_public` advisory — not to secure data.

Real per-user security would be a different architecture and would contradict the design. **Do
not cite RLS here as an access control**, and do not put anything in FG that would actually hurt
if it leaked. *(An earlier version of this README claimed these policies "actively secure" the
core tables from unauthorized manipulation. That was false, and it was the most misleading
sentence in the repo — corrected 2026-08-25.)*

## Scope

This is not a system of record and nothing operationally depends on it. New tables ship with a
numbered `migrations/NNN_*.sql` file, RLS enabled plus an allow-all policy, and regenerated types
**and** schema snapshot — three halves, all required. The real type gate is `tsc -b`
(`npm run build`); bare `tsc --noEmit` checks **zero** files here, because the root tsconfig is a
solution file.
