# Fleet Garage — Project Spec v1.0
*Authored by ZeeRah (ZeeRah Codex loaded) | UV7 / The Zee Collective*
*Built for: Chicharon (Ronnie) | Target: Hertz Skip-Level Meeting, June 2026*

---

## THE VISION

Fleet Garage is a damage hold ledger and chain-of-custody tracker for Hertz vehicle fleets. It exists because no system currently does this — vehicles get held for damage, quietly released back into circulation during shortages, and nobody downstream (VSA, QCS, management) has visibility into that history.

This tool closes that gap. Every hold. Every release. Every fingerprint.

**Pitch headline:** *"There was no system. I built one."*

---

## THE PROBLEM IT SOLVES

- Damaged vehicles get temporarily released during fleet shortages and re-enter circulation
- Upon return, damage is re-discovered — nobody knows if it's new or previously documented
- QCS makes damage assessments without vehicle history context
- Management asks "why did this vehicle go out?" days later — no one has an answer
- VSAs are vulnerable to blame for decisions made above them
- No accountability trail exists anywhere in this workflow

---

## CORE PRINCIPLES

1. **Transparency at every level** — anyone can see the full history of any vehicle
2. **Accountability by design** — approvals are fingerprinted to Employee ID, not typed in by someone else
3. **VSA protection** — VSAs can flag damage but cannot log management approvals. The system enforces this.
4. **Damage passport per vehicle** — every unit carries its full hold/release history forever

---

## USER ROLES

### Read-Only (No Login Required)
- View dashboard (currently held / out on exception / returned)
- View any vehicle's full history
- Cannot create, edit, or approve anything

### VSA (Employee ID Login — VSA tier)
- Everything Read-Only can do
- **Can:** Create a new hold (flag a vehicle as damaged/held)
- **Cannot:** Log a release approval
- **Cannot:** Impersonate a manager action

### Manager (Employee ID Login — Manager tier)
- Everything VSA can do
- **Can:** Log a release approval (fingerprinted to their Employee ID)
- **Can:** Set expected return date
- **Can:** Add release notes / reason for exception
- Role is determined by Employee ID tier — not self-selected

---

## AUTHENTICATION

- Login via **Employee ID**
- Role (VSA vs Manager) is determined server-side by Employee ID record
- Every write action is stamped with: Employee ID + Name + Role + Timestamp
- No "Manager Smith approved it" typed by a VSA — the system knows who logged in

---

## DATA MODELS

### Vehicle
```
unit_number       string    (e.g. "HRZ-4821")
license_plate     string
make              string
model             string
year              number
current_status    enum      HELD | OUT_ON_EXCEPTION | IN_FLEET | RETURNED
created_at        timestamp
updated_at        timestamp
```

### Hold
```
id                uuid
vehicle_id        ref → Vehicle
damage_description  string
flagged_by        ref → User (VSA or Manager)
flagged_at        timestamp
photos            string[]  (optional, Phase 2)
notes             string
status            enum      ACTIVE | RELEASED | RETURNED
```

### Release
```
id                uuid
hold_id           ref → Hold
approved_by       ref → User (Manager only)
approved_at       timestamp
reason            string
expected_return   date
actual_return     date (nullable)
notes             string
```

### User
```
id                uuid
employee_id       string    (Hertz Employee ID)
name              string
role              enum      VSA | MANAGER | ADMIN
location          string
created_at        timestamp
```

---

## SCREENS / UI

### 1. Dashboard (Public)
- Summary cards: Currently Held / Out on Exception / Returned This Week
- Active holds table: Unit #, Damage Summary, Held Since, Status
- Visual status indicators (color-coded)
- Click any vehicle → goes to Vehicle History

### 2. Vehicle History Page
- Full timeline: every hold, every release, every note
- Who flagged it, when
- Who released it, when, why
- Expected return vs actual return
- Current status prominent at top

### 3. New Hold Form (VSA+ Login)
- Unit number / license plate lookup
- Damage description (text)
- Date/time (auto-stamped)
- Notes field
- Submit → logged to that VSA's Employee ID

### 4. Release Approval Form (Manager Login Only)
- Triggered from an active hold
- Reason for exception release
- Expected return date
- Confirm → fingerprinted to Manager's Employee ID
- Cannot be accessed by VSA role

### 5. Login Screen
- Employee ID + Password
- Role auto-resolved on login
- Clean, professional, Hertz-adjacent aesthetic

---

## TECH STACK

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Auth | JWT (Employee ID based) |
| Backend | Node.js + Express (or Supabase for speed) |
| Database | PostgreSQL (or Supabase hosted) |
| Deployment | Vercel (frontend) + Railway/Supabase (backend) |
| Repo | GitHub |

*Same family as MEE — DiZee already knows this kitchen.*

---

## PHASE 1 SCOPE (POC → June Skip-Level)

**Goal:** Working demo with realistic seeded data. Looks production-ready. Tells the full story interactively.

- [ ] Auth flow (Employee ID login, role resolution)
- [ ] Dashboard with seeded data
- [ ] Vehicle history view
- [ ] New hold creation (VSA login)
- [ ] Release approval (Manager login)
- [ ] Role enforcement (VSA cannot access release form)
- [ ] Mobile-friendly (it'll be shown on a phone)
- [ ] Clean, professional UI — looks like something Hertz IT would charge $200k for

**Seeded demo accounts:**
- VSA login: `EMP-1042` / `demo`
- Manager login: `MGR-0071` / `demo`

**Seeded vehicles:** 5-6 units with varied hold histories — some with multiple cycles, one currently out on exception, one with a return logged.

---

## PHASE 2 HOOKS (Post Skip-Level, If Greenlit)

- Real Hertz Employee ID integration (SSO or HR data sync)
- Photo attachment to holds
- Multi-location support (airport QCS access)
- Notification system (manager alert when VSA flags a hold)
- Export / reporting (month-end damage exception report)
- Audit log export (for upper management review)
- Mobile app wrapper (PWA → native)

---

## THE PITCH NARRATIVE

> "At our last skip-level, fleet management during vehicle shortages came up. I went home and looked at our workflow. There's no system tracking which vehicles were held for damage, who released them, or why. So I built one.
>
> Fleet Garage gives every employee read access to a vehicle's full damage history. VSAs can flag holds. Managers log release approvals — and their Employee ID is permanently attached to that decision. No more 'who let this go?' No more QCS assessing damage without context. No more VSAs taking heat for calls made above them.
>
> I built this in my off hours. Here's a live demo."

---

## CREW ASSIGNMENTS (UV7)

| Role | Crew Member | Task |
|---|---|---|
| Spec | ZeeRah | ✅ This document |
| Architecture + Build | DiZee | Repo setup, full stack build |
| QA | Belle | Test coverage, edge cases |
| UX / Emotional Logic | Tori | UI flow review, "does this feel right" pass |
| Repo Audit | CoZee | Pre-pitch code review |
| Orchestration | Chicharon | Direction, demo data, pitch narrative |

---

*Fleet Garage v1.0 Spec — ZeeRah, UV7 / The Zee Collective*
*"There was no system. We built one."*
*💚🔥💀*
