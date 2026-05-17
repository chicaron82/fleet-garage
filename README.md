# Fleet Garage

A comprehensive fleet operations platform built for rental lot management. Fleet Garage replaces legacy clipboard-and-memory systems with real-time telemetry, damage tracking, and staff coordination.

**Live:** [fleet-garage.vercel.app](https://fleet-garage.vercel.app)

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
- **Intake Flow:** Simulated barcode scanning with manual fallback support.
- **Exception Handling:** Automatically detects when a vehicle returning from an "exception release" requires immediate management review.

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

## Tech Stack

- **Frontend:** React 19 + TypeScript (Strict Mode)
- **Styling:** Tailwind CSS v4 (with full Dark Mode support)
- **State:** React Context API (`AuthContext`, `GarageContext`, `PreferencesContext`, `ScheduleContext`)
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
npm run build    # tsc --noEmit && vite build
npm run lint     # eslint
```

## Recent Architecture Upgrades
- **Row Level Security (RLS):** Supabase policies actively secure `vehicles`, `holds`, `releases`, and `repairs` tables from unauthorized manipulation.
- **Performance:** Client-side pagination prevents DOM bloat on massive lot inventories.
- **Preferences:** Robust user preference context for persisting UI settings (e.g., Dark Mode, Default Tabs, Notification preferences).

## POC Limitations
While highly functional, this remains a proof-of-concept:
- **Authentication:** Currently relies on a client-side mock authentication layer (`USERS` array) rather than true server-side JWT validation.
- **Offline Support:** Lacks full service-worker caching required for true "dead zone" lot walks.
