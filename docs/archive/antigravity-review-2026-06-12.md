# Code Review & Architectural Action Plan (2026-06-12)

This document contains the June 2026 code review of Fleet Garage conducted by Antigravity, alongside a concrete implementation plan to address the surfaced architectural concerns.

---

## 🧐 Part 1: Technical Review & Assessment

Fleet Garage has evolved into a production-grade, highly defensive application. Below is an honest assessment of its strengths and weaknesses.

### 🌟 What is Outstanding

1. **The Static Analysis Test ([write-first-contract.test.ts](file:///home/ronnie/Kitchen/fleet-garage/tests/architecture/write-first-contract.test.ts))**: 
   A brilliant, high-confidence testing approach. By reading the source text directly and checking brace-balanced function blocks, it ensures that Supabase writes are awaited and checked *before* React state transitions occur. This prevents state loss on unmounting without the complexity of component-rendering test fixtures.
2. **Idempotent Offline Synchronization ([offlineQueue.ts](file:///home/ronnie/Kitchen/fleet-garage/src/lib/offlineQueue.ts))**:
   The offline write queue is exceptionally robust. By generating random UUIDs client-side and using upsert queries (`ignoreDuplicates`), it solves the lost-ack retry replication issue. The dead-letter queue design prevents persistent failures from blocking the rest of the queue, preserving data integrity.
3. **JWT Expiry Recovery ([writeWithRefresh](file:///home/ronnie/Kitchen/fleet-garage/src/lib/supabase.ts#L39-L47))**:
   A crucial PWA capability. Intercepting `401` PostgREST authorization errors and performing an inline refresh session prevents writes from silently failing when a user re-opens a stale tab.
4. **Attribution Layering**:
   The split resolver design ([useUserResolver](file:///home/ronnie/Kitchen/fleet-garage/src/hooks/useUserResolver.ts)) prevents "Unknown User" bugs on real branches while maintaining fully attribute-rich schedules/metrics on mock-driven demo branches.

---

### ⚠️ Surfaced Concerns

1. **Lack of Static Asset Offline Availability**:
   While the data write layer is highly offline-resilient, the application shell itself is not. If a device loses internet connectivity and the browser reloads the app or the tab is closed, the user will see a standard browser connection error. The PWA lacks static-file caching.
2. **Fragile Governance for USERS Mock Imports**:
   Currently, the prohibition of importing the mock `USERS` dataset outside `useUserResolver` and `useTeamMembers` is governed by a manual checklist and periodic grep commands. This is prone to developer oversight during rapid code additions.
3. **No Stateful Deep-Linking**:
   The app uses custom state switch-case routing. Although browser navigation handles `popstate` events to capture backward movement, there are no stateful URLs. Deep-linking to a specific vehicle (e.g. `fleet-garage.app/vehicle/v123`) or a specific hold is not supported.

---

## 🛠️ Part 2: Proposed Action Plan

Below is the step-by-step implementation plan to resolve the three concerns surfaced during this review.

### 📋 Phase 1: Lint Governance (Static Import Ban)
* **Goal**: Automate the ban on importing mock `USERS` directly in UI components.
* **Proposed Implementation**:
  Modify [eslint.config.js](file:///home/ronnie/Kitchen/fleet-garage/eslint.config.js) to block imports from `data/mock` (except in designated hooks).
* **Changes**:
  Add a new config entry in the eslint flat config file:
  ```js
  {
    // Restrict direct mock USERS import to prevent fallback errors on real branches.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/hooks/useUserResolver.ts', 'src/hooks/useTeamMembers.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/data/mock'],
              message: 'Do not import USERS mock directly. Use useUserResolver or useTeamMembers instead.',
            },
          ],
        },
      ],
    },
  }
  ```

### 📋 Phase 2: Stateful URL Routing (Hash Routing)
* **Goal**: Provide deep-linking and stateful URLs without breaking the lightweight single-page layout structure or unmount-recovery contracts.
* **Proposed Implementation**:
  Use window hash synchronization to map the `screen` state to URLs (e.g. `#/holds`, `#/vehicle/:id`, `#/manifest`, `#/shift`).
* **Changes**:
  1. Refactor `App.tsx` navigation to parse and synchronize window `location.hash` on load and `hashchange` events.
  2. Map route patterns to `Screen` objects:
     - `#/holds` -> `{ name: 'dashboard' }`
     - `#/vehicle/:id` -> `{ name: 'vehicle', vehicleId }`
     - `#/new-hold/:id` -> `{ name: 'new-hold', vehicleId }`
     - `#/register` -> `{ name: 'register-vehicle' }`
     - `#/shift` -> `{ name: 'my-shift' }`
  3. Ensure that when deep-linking, the initialization logic safely rehydrates auth state first.

### 📋 Phase 3: PWA Static Asset Caching (Service Worker)
* **Goal**: Enable the application to boot and load in zero-signal lot walks.
* **Proposed Implementation**:
  Introduce the Vite PWA plugin (`vite-plugin-pwa`) and configure a Service Worker using Workbox.
* **Changes**:
  1. Add `vite-plugin-pwa` to development dependencies.
  2. Update `vite.config.ts` to register the plugin.
  3. Configure the PWA manifest and caching strategies:
     - **Pre-cached assets**: HTML, CSS, JS chunks, SVG icons, and fonts.
     - **Offline fallback**: If offline on initial visit, serve the pre-cached application shell.
  4. Ensure database queries fail back to local queue (`localStorage` or `IndexedDB`) seamlessly without causing browser fetch exceptions.
