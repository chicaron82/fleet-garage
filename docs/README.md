# Fleet Garage — docs/

> **What this folder is:** an idea-drop **inbox**, not a backlog. While on shift and away
> from the computer, Aaron collects ideas and fixes from the crew (Zee, ZeeRah, Belle, DiZee)
> and drops them here so they're easy to reference instead of pasting into chat.
>
> **The month archives are already implemented** — nothing in `April/`, `May/`, or `June/` is open work.
> The only open work lives in the top-level **open tickets** (they carry `status: open`).
>
> ⚠️ **The archives are history, not documentation.** Each ticket was validated before cooking
> and frequently **evolved past** what was originally written — so where a doc and the code
> disagree, **the code is the source of truth.** Don't read an archived spec as the current design.
>
> **Structure:** top-level holds only the **meta** files + **open tickets** (live `status` frontmatter,
> still being worked). **On ship, a ticket is archived to its month folder** so the top level always shows
> just what's open. `archive/` is a month-agnostic home for **non-ticket artifacts** (reviews,
> delivered code drops, one-offs).

**Going forward:** new tickets follow [CONVENTIONS.md](CONVENTIONS.md) — copy [TICKET_TEMPLATE.md](TICKET_TEMPLATE.md). When a ticket ships, it moves to the current month's folder.

---

## 📥 Open tickets

- _(none — top level is just the 3 meta files right now.)_

## 🗓️ June ships

_Full folder, rebuilt from the stamps on 2026-06-10 (the earlier list had drifted to 6 of the folder's entries). 27 shipped + 1 dropped._

**2026-06-03**
- [June/ticket-holds-ev-assets-tab.md](June/ticket-holds-ev-assets-tab.md) — EV Assets tab in Holds: unified Tesla cable/adapter timeline across all four sources + both-missing auto-hold. **✅** · `3afdfc4` `a50138d` `6879bc2` `ff4d70d`.

**2026-06-04**
- [June/bug-holds-mechanical-missing-concerns.md](June/bug-holds-mechanical-missing-concerns.md) — "Geotab not installed" mechanical concern. **✅** · `05223dc`.
- [June/bug-washbay-backfill-rollover-prefill.md](June/bug-washbay-backfill-rollover-prefill.md) — backfill log page rollover + team-size/OT prefill + reliable save (extracted `BackfillEntryForm`). **✅** · `81990c9`.
- [June/ticket-holds-ev-quick-add-tesla.md](June/ticket-holds-ev-quick-add-tesla.md) — quick-add a transfer Tesla from the EV Assets tab (lands `CLEAR`; `addVehicle` gained optional `status?`). **✅** · `640f406`.
- [June/ticket-schedule-stat-pto-alternate.md](June/ticket-schedule-stat-pto-alternate.md) — warn on stat-day PTO + capture an optional alternate date (migration `069`); surfaced in PTO request text + PDF. **✅** · `afc5388`.

**2026-06-05**
- [June/ticket-edv-plate-field.md](June/ticket-edv-plate-field.md) — add an optional plate field to EDV no-match OTH entries. **✅** · `e50a8b0`.
- [June/ticket-edv-plate-condition-pills.md](June/ticket-edv-plate-condition-pills.md) — EDV plate field + exterior/interior condition pills. **✅** · `e50a8b0`.

**2026-06-07** (ZeeRah's blind-review batch — see `archive/REVIEW-NOTES-2026-06-07.md`)
- [June/bug-fleet-status-single-source.md](June/bug-fleet-status-single-source.md) — make fleet-master status the single source so an empty bucket can't crash the view. **✅** · `988ba37`.
- [June/bug-movement-offline-queue-wedge.md](June/bug-movement-offline-queue-wedge.md) — stop a lost-ack offline insert from permanently wedging the sync queue. **✅** · `fa9ceca`.
- [June/bug-notifications-read-race.md](June/bug-notifications-read-race.md) — make notification read-state survive concurrent marking. **✅** · `4c55244`.
- [June/bug-oth-edv-stale-fields.md](June/bug-oth-edv-stale-fields.md) — clear EDV plate/condition when the preset is re-selected. **✅** · `c97abad`.
- [June/bug-oth-recovery-orderby.md](June/bug-oth-recovery-orderby.md) — off-standard session recovery no longer breaks when an orphan in-progress row exists. **✅** · `fa9ceca`.
- [June/bug-shift-equal-times-24h.md](June/bug-shift-equal-times-24h.md) — stop equal actual start/end reading as a 24-hour shift. **✅** · `c97abad`.
- [June/ticket-shift-pay-period-prev-next.md](June/ticket-shift-pay-period-prev-next.md) — previous + next pay-period estimates on the pay card. **✅** · `6e55036`.
- [June/ticket-washbay-carryover-lineage.md](June/ticket-washbay-carryover-lineage.md) — port last night's leftover queue into morning as backlog that converts to credit as it clears. **✅** · `60eaa6e`.

**2026-06-09**
- [June/bug-lost-and-found-relative-day.md](June/bug-lost-and-found-relative-day.md) — Lost & Found "Today/Yesterday" + "Day N" computed from shift-days, not elapsed hours. **✅** · `9feca37`.
- [June/bug-oth-offstandard-write-pk-guard.md](June/bug-oth-offstandard-write-pk-guard.md) — guard `offStandardWrite` against inserts missing a primary key (dedup upsert on `id`). **✅** · `0ffbe8e`.
- [June/bug-schedule-clear-actual-hours.md](June/bug-schedule-clear-actual-hours.md) — a "Clear actual hours" path so saved actual times can be removed. **✅** · `4078734`.
- [June/bug-vehicle-plate-recognition-debounce.md](June/bug-vehicle-plate-recognition-debounce.md) — debounce plate-recognition lookups to stop per-keystroke queries. **✅** · `054fae9`.
- [June/ticket-analytics-offstandard-legibility.md](June/ticket-analytics-offstandard-legibility.md) — decompose off-standard so airport trips aren't double-shown in the shift summary. **✅** · `c10fde1`.
- [June/ticket-washbay-opener-backfill-lineage.md](June/ticket-washbay-opener-backfill-lineage.md) — opener backfills the prior shift-day's closing log; carry-over lineage reads it. **✅** · `f739645`.

**2026-06-10** (the storm-night batch)
- [June/bug-holds-repair-close-linked-exception.md](June/bug-holds-repair-close-linked-exception.md) — repairing a linked re-hold auto-closes the prior open exception, so a fixed vehicle leaves the On-Exception list. **✅** · `500e200`.
- [June/bug-holds-duplicate-flag-race.md](June/bug-holds-duplicate-flag-race.md) — a synchronous in-flight ref stops a double-submit from flagging two holds for one issue. **✅** · `0afed0d`.
- [June/ticket-holds-hail-type.md](June/ticket-holds-hail-type.md) — first-class **Hail** hold type (⛈️ storm-indigo badge) for the storm batch — countable/badged as its own group. **✅** · `49b9654`.
- [June/bug-schedule-week-swipe-boundary.md](June/bug-schedule-week-swipe-boundary.md) — week-view swipe scrolls to Sunday before navigating weeks (boundary-aware gate). **✅** · `9bce75f`.
- [June/bug-vehicle-input-keyboard-consistency.md](June/bug-vehicle-input-keyboard-consistency.md) — numeric pad for unit #, caps display for plates. **✅** · `fee3854`.

**2026-06-11**
- [June/ticket-shift-payday-anchored-period.md](June/ticket-shift-payday-anchored-period.md) — anchor the pay card on the next-cheque (earned-but-unpaid) period, not the calendar one; payday-lag constant + state-derived confidence labels + per-block payday. **✅** · `d14983d`.
- [June/ticket-holds-vehicle-operations-test-net.md](June/ticket-holds-vehicle-operations-test-net.md) — behaviour-locking net for `useVehicleOperations`: 17 tests covering primary-write-failure contracts, vehicle-status derivation, and optimistic-state gating across all exported ops. **✅** · `0674161`.
- [June/bug-holds-addhold-shared-guard.md](June/bug-holds-addhold-shared-guard.md) — move the duplicate-flag guard into `addHold` so all six callers are protected, not just `useNewHold`. **✅** · `e131340`.
- [June/bug-submit-lock-class-sweep.md](June/bug-submit-lock-class-sweep.md) — shared `withSubmitLock` at the write layer kills the double-submit class app-wide (`addHold`/`addRelease`/`createShift`/`bulkCreateShifts`/`addIssue`); convention in CLAUDE.md. **✅** · `e131340`.
- [June/ticket-holds-pin-at-capture-back-visible.md](June/ticket-holds-pin-at-capture-back-visible.md) — pin the card photo from the flag form (📌 toggle; `addHold` returns the uploaded URLs, pinned post-submit) + scroll-reset on nav so ← Back is visible after creating a hold. **✅** · `803a46a`.
- [June/ticket-holds-multi-issue-resolution.md](June/ticket-holds-multi-issue-resolution.md) — resolve each issue in a multi-type hold independently (`resolved_types[]`, migration 077; cascade untouched — partial holds stay ACTIVE) + scroll-to-section on the flag form. **✅** · `f8ec781` `7295a69`.

**Dropped**
- [June/bug-washbay-deferred-double-count.md](June/bug-washbay-deferred-double-count.md) — deferred plate-install double-count (handoff `carryOverCleared` vs closing `deferredCompletions`). **⬇️ dropped** — superseded by `ticket-washbay-carryover-lineage` (`60eaa6e`), which resolves the same seam cleanly.

## 🗄️ archive/ (non-ticket artifacts)

- [archive/fable-review-2026-06-09.md](archive/fable-review-2026-06-09.md) — blind Fable 5 review: praised the write-first contract + 330 cap, flagged the offline-queue flush gap and silent dead writes (both fixed), and RLS-by-anon-key (settled by scope — crew-only, by design).
- [archive/REVIEW-NOTES-2026-06-07.md](archive/REVIEW-NOTES-2026-06-07.md) — ZeeRah's blind-review batch (8 findings) that seeded the 2026-06-07 ship cluster (offline/recovery story, notification race, OTH/EDV fixes).
- [archive/fleet_garage_review.md](archive/fleet_garage_review.md) — blind code review that seeded the early-June triage: error boundary, vehicles realtime, `useDriverLiveTrip` refactor.
- [archive/STORAGE_BUCKET_FIXES_SPEC.md](archive/STORAGE_BUCKET_FIXES_SPEC.md) — photo-upload bucket-name / RLS-policy fixes spec. **✅** · `2affd2c`.
- [archive/WashbayHistorySection.tsx](archive/WashbayHistorySection.tsx) — ZeeRah's single-file backfill fix, superseded by the recook (`81990c9`).

## 📌 Living reference data

Still current-ish — verify against the live DB / registry before acting on them:

- [May/supabase.md](May/supabase.md) — snapshot of Supabase RLS policies (table · policy · cmd).
- [May/ywg-vehicle-codex.md](May/ywg-vehicle-codex.md) — YWG Hertz vehicle code/class codex.
- [May/ywg-vehicle-registry-clean.csv](May/ywg-vehicle-registry-clean.csv) — cleaned YWG vehicle registry.
- [May/ywg-vehicle-registry-batch2.csv](May/ywg-vehicle-registry-batch2.csv) — second registry batch.

---

## 📦 Historical archives

`April/` (53 files) — genesis era: the original ops-platform concept through early feature specs. Browse the folder or `git log` for specifics.

`May/` (90 files) — the main build-out era: holds, movement log, OTH, schedule, analytics, and more. Browse the folder or `git log` for specifics.

---

_README.md replaces INDEX.md — 2026-06-04. Archives are navigational; code is truth._
