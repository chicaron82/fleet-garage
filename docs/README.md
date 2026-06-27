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

**Going forward:** new tickets follow [CONVENTIONS.md](CONVENTIONS.md) — copy [TICKET_TEMPLATE.md](TICKET_TEMPLATE.md). When a ticket ships, it's stamped (`status` / `shipped` / `commit`) and moved to its month folder.

> **This README tracks open work + reference only — it does *not* catalog what shipped.** That's
> already recorded twice: the **stamped ticket frontmatter** in the month folders, and the
> **[chicharons blog](../../chicharons-kitchen/)** narrative. A hand-kept ship-list here only drifts
> (it did, and had to be rebuilt from the stamps). For "what shipped," read the month folder or the blog.

---

## 📥 Open tickets

_"Hey FG" assistant — next tier (riffed 2026-06-26; build order: voice → key-tag → schedule):_
- [ticket-misc-assistant-voice.md](ticket-misc-assistant-voice.md) — hands-free ask + spoken read-back (Web Speech API; no backend, no cost). The cheap, bougie, lowest-risk one.
- [ticket-optical-keytag-autofill.md](ticket-optical-keytag-autofill.md) — photo a key tag → OCR unit/plate/class → autofill the register-then-hold. Reuses the Tier 3 vision plumbing.
- [ticket-schedule-photo-import.md](ticket-schedule-photo-import.md) — photo the VSA grid → FG drafts the week behind a preview-you-verify gate. The big one (dense-grid vision + a real bulk write path); spec before cooking.

_Other:_
- [ticket-chicharon-council-concept.md](ticket-chicharon-council-concept.md) — the Council of Z: a multi-agent roundtable hub for the UV7 crew (parked concept; revisit on a weekend).

## 🗄️ archive/ (non-ticket artifacts)

- [archive/antigravity-review-2026-06-12.md](archive/antigravity-review-2026-06-12.md) — Antigravity code review: detailed take on the write-first contract, offline queue, JWT auto-refresh, and a 3-phase action plan for asset caching, lint governance, and deep-linking.
- [archive/fable-review-2026-06-09.md](archive/fable-review-2026-06-09.md) — blind Fable 5 review: praised the write-first contract + 330 cap, flagged the offline-queue flush gap and silent dead writes (both fixed), and RLS-by-anon-key (settled by scope — crew-only, by design).
- [archive/REVIEW-NOTES-2026-06-07.md](archive/REVIEW-NOTES-2026-06-07.md) — ZeeRah's blind-review batch (8 findings) that seeded the 2026-06-07 ship cluster (offline/recovery story, notification race, OTH/EDV fixes).
- [archive/fleet_garage_review.md](archive/fleet_garage_review.md) — blind code review that seeded the early-June triage: error boundary, vehicles realtime, `useDriverLiveTrip` refactor.
- [archive/STORAGE_BUCKET_FIXES_SPEC.md](archive/STORAGE_BUCKET_FIXES_SPEC.md) — photo-upload bucket-name / RLS-policy fixes spec.
- [archive/WashbayHistorySection.tsx](archive/WashbayHistorySection.tsx) — ZeeRah's single-file backfill fix, superseded by the recook (`81990c9`).

## 📌 Living reference data

Still current-ish — verify against the live DB / registry before acting on them:

- [May/supabase.md](May/supabase.md) — snapshot of Supabase RLS policies (table · policy · cmd).
- [May/ywg-vehicle-codex.md](May/ywg-vehicle-codex.md) — YWG Hertz vehicle code/class codex.
- [May/ywg-vehicle-registry-clean.csv](May/ywg-vehicle-registry-clean.csv) — cleaned YWG vehicle registry.
- [May/ywg-vehicle-registry-batch2.csv](May/ywg-vehicle-registry-batch2.csv) — second registry batch.

---

## 📦 Month archives (history — stamped in frontmatter; code is truth)

Each shipped ticket lives here with its `shipped` + `commit` stamp. Browse the folder or the blog
for specifics — this README doesn't re-list them.

- `April/` (53 files) — genesis era: the original ops-platform concept through early feature specs.
- `May/` (90 files) — the main build-out: holds, movement log, OTH, schedule, analytics, and more.
- `June/` — EV assets, washbay carry-over lineage, the storm-night batch (hail type, dup-flag race), payday-anchored pay card, multi-issue resolution, the submit-lock sweep.

---

_README.md replaces INDEX.md — 2026-06-04. Tracks open work + reference; shipped work is stamped in the month folders and told in the blog._
