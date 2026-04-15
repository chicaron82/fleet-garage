# Fleet Garage

A vehicle damage hold ledger for rental fleet management. Built for Hertz lot operations — tracks damage flags, management releases, pre-existing conditions, and repair completions across the fleet.

**Live:** [fleet-garage.vercel.app](https://fleet-garage.vercel.app)

## What It Does

Fleet Garage replaces the clipboard-and-memory system for tracking damaged vehicles on the lot. Staff can:

- **Flag damage** — VSAs document scratches, dents, windshield chips, interior damage, and detail issues (dirt, pet hair, smoke) with photos and notes
- **Track holds** — every flagged vehicle is held until management acts on it
- **Release on exception** — managers approve temporary releases when the fleet is short, with expected return dates
- **Mark pre-existing** — management can classify known damage as "renting as-is" — no repair planned, no ambiguity
- **Mark repaired** — when a vehicle comes back from the shop, managers confirm the repair and clear it for service
- **View history** — every vehicle has a full damage timeline: who flagged it, who released it, when it came back, who repaired it

## Roles

| Role | Can Flag | Can Release / Repair |
|------|----------|---------------------|
| VSA (Vehicle Service Attendant) | Yes | No |
| Lead VSA | Yes | No |
| CSR (Customer Service Rep) | Yes | No |
| HIR (Hourly In-house Rep) | Yes | No |
| Branch Manager | Yes | Yes |
| Operations Manager | Yes | Yes |

## Stack

- **React 19** + TypeScript (strict mode)
- **Vite** + Tailwind CSS v4
- **Supabase** — PostgreSQL (vehicles, holds, releases, repairs) + Storage (damage photos)
- **Vercel** — deployment

## Project Structure

```
src/
  App.tsx                          # Router + layout (106 lines)
  main.tsx                         # Entry point + providers
  types/index.ts                   # All domain types
  context/
    AuthContext.tsx                 # Employee ID login
    GarageContext.tsx               # Supabase CRUD + state
    PreferencesContext.tsx          # Dark mode + settings
  hooks/
    useNewHold.ts                  # Flag damage form logic
    useVehicleHistory.ts           # Vehicle detail + photo handling
  components/
    LoginScreen.tsx                # Employee ID + password
    Dashboard.tsx                  # Summary cards + vehicle list
    NewHoldForm.tsx                # Flag damage / detail issue
    VehicleHistory.tsx             # Vehicle detail + damage timeline
    ReleaseForm.tsx                # Exception / pre-existing release
    RegisterVehicleForm.tsx        # Add new vehicle to ledger
    StatusBadge.tsx                # Color-coded status pills
    HoldRecordFooter.tsx           # Release / repair record display
    LogoutConfirm.tsx              # Sign-out confirmation
    UserProfileMenu.tsx            # Profile + settings dropdown
  lib/
    supabase.ts                    # Supabase client
    image.ts                       # Photo compression (800px, 72% JPEG)
  data/
    mock.ts                        # Demo users + seed data
```

## Running Locally

```bash
npm install
npm run dev
```

Requires a `.env` file:

```
VITE_SUPABASE_URL=<your-supabase-project-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

### Supabase Setup

The app expects four tables: `vehicles`, `holds`, `releases`, `repairs` — plus a `damage-photos` storage bucket with a public INSERT policy.

### Build

```bash
npm run build    # tsc -b && vite build
npm run lint     # eslint
```

## Vehicle Lifecycle

```
New vehicle registered
  → HELD (damage flagged)
    → OUT_ON_EXCEPTION (released temporarily by management)
      → RETURNED (came back from exception rental)
    → PRE_EXISTING (management accepts damage, renting as-is)
    → CLEAR (damage repaired, back in service)
```

## Design Decisions

- **Optimistic UI** — local state updates immediately after Supabase writes, with error throws on failure
- **Photo compression** — images are resized to 800px max width and compressed to 72% JPEG before upload, keeping storage costs low
- **Role-based access** — only Branch Manager and Operations Manager can release holds or confirm repairs. Enforced at the component level
- **UUID IDs** — `crypto.randomUUID()` for all records (vehicles, holds, releases, repairs)
- **Dark mode** — full dark theme support via Tailwind `dark:` variants and PreferencesContext

## POC Limitations

This is a proof of concept. Production would need:

- Supabase Row Level Security (RLS) policies
- Server-side auth (currently client-side employee ID matching)
- Audit logging
- Pagination for large fleets
- Push notifications for hold status changes
- Offline support for lot walks
