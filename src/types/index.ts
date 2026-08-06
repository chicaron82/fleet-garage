// ── Core Types ─────────────────────────────────────────────────────────────────

export type Module = 'my-day' | 'holds' | 'movement-log' | 'my-shift' | 'lost-and-found' | 'audits' | 'analytics' | 'schedule' | 'issue-log' | 'manifest' | 'fleet-master' | 'effie';

// Where the app lands after login: pin My Shift, or resume the last-visited module.
export type LandingTab = 'my-shift' | 'last-visited';

export type BranchId = 'YWG' | 'YWG-South' | 'YYC' | 'YVR' | 'ALL';

export interface BranchConfig {
  id: BranchId;
  name: string;
  enabledModules: Module[];
}

// ── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'VSA' | 'Lead VSA' | 'CSR' | 'HIR' | 'Branch Manager' | 'Operations Manager' | 'City Manager' | 'AGM' | 'GM' | 'Driver';

export const CAN_RELEASE: UserRole[] = ['Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canRelease(role: UserRole): boolean {
  return CAN_RELEASE.includes(role);
}

// Confirming a repair / marking a hold done is an OBSERVATION — the person at the
// washbay can see the crack is fixed — so VSAs + Lead VSAs can do it (on top of
// management), and it's attributed to whoever actually did it. This is distinct
// from CAN_RELEASE: releasing a known-damaged car on exception is a liability
// judgment that stays management-only.
export const CAN_MARK_REPAIRED: UserRole[] = ['VSA', 'Lead VSA', ...CAN_RELEASE];

export function canMarkRepaired(role: UserRole): boolean {
  return CAN_MARK_REPAIRED.includes(role);
}

// Marking a hold PRE_EXISTING is a bookkeeping call, not a liability one — the damage
// was already on the car (accepted as-is, vehicle keeps circulating), unlike EXCEPTION
// (sending a NEWLY-damaged car out on an override) which stays management-only via
// CAN_RELEASE. So floor VSAs may mark pre-existing, like they mark repaired.
export const CAN_MARK_PRE_EXISTING: UserRole[] = ['VSA', 'Lead VSA', ...CAN_RELEASE];

export function canMarkPreExisting(role: UserRole): boolean {
  return CAN_MARK_PRE_EXISTING.includes(role);
}

// Who can clear a sale/auction flag logged in error — the staff who can flag a
// vehicle in the first place (floor VSAs + management), so a mistake can be
// self-corrected. Every clear is audited and pings management for awareness.
const CAN_CLEAR_SALE_FLAG: UserRole[] = ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canClearSaleFlag(role: UserRole): boolean {
  return CAN_CLEAR_SALE_FLAG.includes(role);
}

const CAN_LOG_HANDOFF: UserRole[] = ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canLogHandoff(role: UserRole): boolean {
  return CAN_LOG_HANDOFF.includes(role);
}

const CAN_ACTION_LOST_FOUND: UserRole[] = ['CSR', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

/**
 * Who can action (contact / return / throw out) a lost-and-found item. The role
 * list is the standard gate; once an item has been held `days` ≥ 30 the holding
 * obligation has elapsed, so ANY role (incl. plain VSA) may dispose of it without
 * escalating. Pass `daysHeld(item.foundAt)` for the age-aware unlock; omit it for
 * the role-only check.
 */
export function canActionLostFound(role: UserRole, days?: number): boolean {
  return CAN_ACTION_LOST_FOUND.includes(role) || (days != null && days >= 30);
}

const CAN_WRITE_WHITEBOARD: UserRole[] = ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canWriteWhiteboard(role: UserRole): boolean {
  return CAN_WRITE_WHITEBOARD.includes(role);
}

// Who can build the floor schedule: enter shifts for *other* people and manage
// roster-only staff (board-only VSAs/drivers who never log in). Mirrors the
// whiteboard set — Lead VSA + managers — since leads own the schedule in practice.
const CAN_MANAGE_SCHEDULE: UserRole[] = ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canManageSchedule(role: UserRole): boolean {
  return CAN_MANAGE_SCHEDULE.includes(role);
}

// ── Whiteboard ───────────────────────────────────────────────────────────────

export type WhiteboardSection = 'reminders' | 'downtime' | 'airport' | 'shift_board';
export type WhiteboardTriggerType = 'manual' | 'seasonal' | 'calendar_month';

export interface WhiteboardNote {
  id: string;
  branchId: string;
  section: WhiteboardSection;
  body: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  triggerType: WhiteboardTriggerType;
  activeMonths?: number[];
  status: 'active' | 'archived';
  createdAt: string;
  archivedAt?: string;
  archivedById?: string;
}

// ── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  employeeId: string;
  name: string;
  role: UserRole;
  branchId: BranchId;
  /** True for board-only staff (schedule entered for them; they never log in).
   *  Real authenticated users are undefined/false. See migration 082. */
  rosterOnly?: boolean;
  /** Display flag: a utility/maintenance staffer (e.g. the in-house PM-cars person).
   *  Shades + tags their schedule row to set them apart from drivers — does NOT
   *  affect role or scheduling group. See migration 087. */
  utility?: boolean;
}

/**
 * Row from the `profiles` table (migration 054). Same shape as `User`, but
 * separately named to mark intent: a `Profile` is "any team member you might
 * need to resolve by id", whereas `User` is "the currently authenticated user
 * in this session".
 */
export type Profile = User;

// ── Vehicles ─────────────────────────────────────────────────────────────────

export type VehicleStatus    = 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED' | 'PRE_EXISTING' | 'CLEAR' | 'SALE_CAR' | 'AUCTION_SHORT_TERM';
export type EvAssetStatus    = 'present' | 'missing';
// Where an EV-accessory observation came from — tags each ev_asset_updates row
// so the unified timeline shows which touchpoint last saw the cable/adapter.
export type EvSource         = 'check_in' | 'driver_trip' | 'vsa_washbay' | 'management';

// A lent EV asset (cable or adapter) as a structured cross-vehicle link, not a
// free-text note. The borrower is a unit# (text) resolved to a vehicle at read
// time — so a lend to a not-yet-registered unit records and links later.
export type EvLoanAsset = 'cable' | 'adapter';
export interface EvAssetLoan {
  id: string;
  lenderVehicleId: string;
  assetType: EvLoanAsset;
  borrowerUnit: string;
  status: 'out' | 'returned';
  notes: string | null;
  createdAt: string;
  createdBy: string | null;
  returnedAt: string | null;
  returnedBy: string | null;
}

export type VehicleEditStatus = 'pending' | 'approved' | 'denied';

/** How an identity field's current value was set — provenance for the key-tag ladder
 *  (inferred < tag < manual). Absent from a vehicle's `fieldSources` means inferred/unknown. */
export type FieldSource = 'tag' | 'manual';

export interface Vehicle {
  id: string;
  unitNumber: string | null;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: VehicleStatus;
  branchId: BranchId;
  /** Rental class — the boss's size/type group code (Q4, P4, T, L2…), read off the keytag's
   *  top corner. The shorthand the boss uses to request returns; null when unknown/manual. */
  rentalClass?: string | null;
  /** Per-field provenance for the key-tag identity fields (make/model/year/color/rentalClass/
   *  unitNumber): which source last set each value. Absent key = inferred/unknown (freely
   *  overwritten); 'tag' = read off a key tag; 'manual' = Aaron edited it (LOCKED — no scan
   *  overrides it). The provenance ladder inferred < tag < manual — migration 105 /
   *  docs/ticket-keytag-field-provenance.md. */
  fieldSources?: Record<string, FieldSource>;
  /** How many keys are on the ring. The EXPECTED count — what the car should come back with —
   *  so the check-in can diff it instead of the operator remembering. Null until first observed. */
  keyCount?: number | null;
  /** The key tag photo the vision read was made FROM — evidence for auditing/correcting a
   *  misread, and the provenance for teaching the codex a new class code. Latest tag wins. */
  keytagPhotoUrl?: string | null;
  coverPhotoUrl?: string;
  archivedAt?: string;
  archivedById?: string;
  // EV / Tesla accessories
  isTesla: boolean;
  // Hybrid is an attribute (a checkbox), not a hard-coded "<Base> Hybrid" model — mirrors isTesla.
  // Optional in the app model; the DB column is NOT NULL DEFAULT false, so reads coalesce to false.
  isHybrid?: boolean;
  hasMobileCable: boolean | null;
  hasJ1772Adapter: boolean | null;
  evLastUpdatedBy?: string | null;
  evLastUpdatedAt?: string | null;
  // Edit suggestion fields
  editSuggestedUnit?: string | null;
  editSuggestedPlate?: string;
  editSuggestedBy?: string;
  editSuggestedAt?: string;
  editSuggestionNote?: string;
  editStatus?: VehicleEditStatus | null;
  editReviewedBy?: string;
  editReviewedAt?: string;
}

export function canManageVehicles(role: UserRole): boolean {
  // VSA is included for FG's personal-first mode: Aaron is the sole operator, so the
  // floor role gets full vehicle management — archive/restore, direct identity edits
  // (suggest→review has no reviewer when solo), and EV asset editing. Lead VSA belongs
  // here too — every OTHER role-gate in this file pairs 'VSA' with 'Lead VSA'
  // (CAN_MARK_REPAIRED, CAN_MARK_PRE_EXISTING, schedule, handoff, sale-flag…); this was
  // the one outlier, and it silently routed Lead VSA to the suggest-and-wait-for-approval
  // sheet instead of the direct edit — found live 2026-07-22 when Aaron (Lead VSA) hit
  // the field-provenance ladder's own edit modal and couldn't reach make/model/class.
  return ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager'].includes(role);
}

// ── Holds ────────────────────────────────────────────────────────────────────

export type HoldStatus = 'ACTIVE' | 'RELEASED' | 'RETURNED' | 'REPAIRED' | 'VOIDED';
export type HoldType = 'damage' | 'hail' | 'detail' | 'mechanical' | 'sale_car' | 'missing_accessories';
export type DetailReason = 'too-dirty' | 'pet-hair' | 'smoke-vape';
export type MechanicalSubType = 'tire-swap' | 'tire-repair' | 'pm-due' | 'safety-recall' | 'other';

export const DETAIL_REASON_LABELS: Record<DetailReason, string> = {
  'too-dirty': 'Too dirty',
  'pet-hair':  'Pet hair',
  'smoke-vape': 'Smoke / vape',
};

export const VSA_CLEARABLE_REASONS: DetailReason[] = ['smoke-vape', 'too-dirty'];

export function canVsaClear(reason: DetailReason): boolean {
  return VSA_CLEARABLE_REASONS.includes(reason);
}

export interface Hold {
  id: string;
  vehicleId: string;
  holdTypes: HoldType[];   // all types for this hold (min 1)
  holdType: HoldType;      // primary type = holdTypes[0], kept for backwards compat
  resolvedTypes: HoldType[]; // which holdTypes are cleared; hold flips REPAIRED once it covers holdTypes
  detailReason?: DetailReason;
  mechanicalSubType?: MechanicalSubType | null;
  damageDescription: string;   // for damage holds; "Detail required — X" for detail holds
  flaggedById: string;         // User.id (auth UUID)
  flaggedByName: string;
  flaggedByEmployeeId: string;
  flaggedSource?: string | null; // null = hand-flagged; 'effie' = written through Effie (shown "· via Effie")
  flaggedAt: string;           // ISO timestamp
  notes: string;
  photos?: string[];
  status: HoldStatus;
  linkedHoldId?: string;
  release?: Release;
  repair?: Repair;
  branchId: BranchId;
  offstandardLinked?: boolean;
  cleanedInhouseLoggedAt?: string | null;
}

// ── Releases ─────────────────────────────────────────────────────────────────

export type ReleaseType = 'EXCEPTION' | 'PRE_EXISTING' | 'MECHANICAL_RELEASE';
export type ReleaseMethod = 'standard' | 'verbal_override';

export interface Release {
  id: string;
  holdId: string;
  approvedById: string;      // User.id — Manager for standard, VSA executor for verbal
  approvedAt: string;        // ISO timestamp
  releaseType: ReleaseType;
  releaseMethod: ReleaseMethod;
  overrideAuthorization?: string; // Manager name — for verbal overrides (POC: free text)
  reason: string;
  expectedReturn?: string;   // ISO date — required for standard EXCEPTION, optional otherwise
  actualReturn?: string;     // ISO date — set when vehicle is returned
  notes: string;
}

// ── Repairs ──────────────────────────────────────────────────────────────────

export type RepairOutcome = 'clean' | 'scar-remains';

export const REPAIR_OUTCOME_LABELS: Record<RepairOutcome, string> = {
  'clean':        'Repaired — clean',
  'scar-remains': 'Repaired — scar remains',
};

export interface Repair {
  id: string;
  holdId: string;
  repairedById: string;   // User.id — Manager only
  repairedAt: string;     // ISO timestamp
  notes: string;
  outcome: RepairOutcome;
}

// ── Handoff Notes ─────────────────────────────────────────────────────────────

export type LotStatus = 'zeroed' | 'manageable' | 'backlog';

export interface HandoffNote {
  id: string;
  branchId: string;
  loggedById: string;
  loggedByName: string;
  loggedAt: string;
  fullPages: number;
  lastPageEntries: number;
  teamSize: number;
  notes?: string;
  lotStatus: LotStatus;
  morningHours: number; // default 8.0 — productive hours (excludes 30min unpaid lunch)
  carryOverCleared: number; // prior-day-fuelled cars cleaned & sent today (no fresh gas line)
  airportFlipping: boolean; // Manual attestation: morning crew ran quick turnarounds at the airport
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export interface ScannedPayload {
  vehicleId?: string;
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  rentalClass?: string;  // single letter from tag: C, B, D, etc.
  owningArea?: string;   // owning area number: 8199
  needsReview?: boolean;
}

// ── Navigation ──────────────────────────────────────────────────────────────

/** A key-tag read carried INTO the register form, so a scan never makes the operator retype
 *  what FG just read off the tag. `prefill` (plate-or-unit) predates this and stays for the
 *  hand-typed paths; a scan fills every field it actually read. */
export interface ScannedIdentity {
  unitNumber: string;
  plate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  /** Rental class read off the tag's top corner (Q4, P4, T…), carried into registration
   *  so it's stored on the vehicle. Empty when the tag's class corner wasn't legible. */
  rentalClass: string;
  /** True when `rentalClass` above was INFERRED from the class code (the learned code→class store),
   *  not read off the tag — so the register form flags it honestly instead of "read off the tag". */
  rentalClassInferred?: boolean;
  /** Hybrid, resolved from the tag's class code via the codex — pre-checks the register toggle. */
  isHybrid?: boolean;
  /** The tag's class code, set ONLY when the codex couldn't resolve it. Its presence means
   *  "registering this car also teaches FG what this code is" — the operator holding the tag
   *  is the authority. Absent for codes the codex already knows (nothing to learn). */
  teachClassCode?: string;
}

export type Screen =
  | { name: 'dashboard' }
  | { name: 'my-day' }
  | { name: 'vehicle'; vehicleId: string }
  | { name: 'new-hold'; vehicleId?: string; fromRegister?: boolean; prefillNonce?: number }
  | { name: 'register-vehicle'; fromHold?: boolean; prefill?: string; scanned?: ScannedIdentity; scannedPhoto?: string }
  // `prefillNonce` makes each scan a DISTINCT routing event: the plate is a bare string that
  // compares equal across two scans of the same tag, so a value-keyed re-seed would fire only
  // once and a repeat scan (after a reset/complete) would silently no-op — the plate field stays
  // empty (found on the lot 2026-07-21). The nonce changes per scan, so the destination re-seeds
  // every time. Absent for hand-typed nav (no re-seed needed).
  // `autoStart` (scan-router "Start trip") fires a Routine Transport run on arrival so the operator
  // lands on the live timer instead of tapping a quick-start — one fewer tap on the header route.
  | { name: 'movement-log'; prefillPlate?: string; prefillNonce?: number; autoStart?: boolean }
  | { name: 'my-shift' }
  | { name: 'lost-and-found'; prefillPlate?: string; prefillNonce?: number }
  | { name: 'audits' }
  | { name: 'audit-form' }
  | { name: 'analytics' }
  | { name: 'schedule'; openImport?: boolean }
  | { name: 'issue-log' }
  | { name: 'manifest' }
  | { name: 'fleet-master' }
  | { name: 'effie' };

// ── Audits ───────────────────────────────────────────────────────────────────

export type AuditResult = 'pass' | 'fail' | 'pending';
export type AuditStatus = 'PASSED' | 'FAILED' | 'IN_PROGRESS';

export interface AuditCheckItem {
  id: string;
  label: string;
  result: AuditResult;
  photoUrl?: string;
}

export interface AuditSection {
  id: string;
  label: string;
  items: AuditCheckItem[];
  notes: string;
  isOpen: boolean;
}

export type AuditPosition = 'driver-side' | 'passenger-side' | 'sprayer-prep';

export const AUDIT_POSITION_LABELS: Record<AuditPosition, string> = {
  'driver-side':    'Driver Side',
  'passenger-side': 'Passenger Side',
  'sprayer-prep':   'Sprayer / Prep',
};

export interface AuditCrewMember {
  employeeId: string;
  name: string;
  position: AuditPosition;
}

export interface AuditCrewSlot {
  employeeId: string;
  name: string;
}

export interface AuditCrew {
  driverSide: AuditCrewSlot;
  passengerSide: AuditCrewSlot;
  sprayer: AuditCrewSlot;
}

export interface AuditRecord {
  id: string;
  date: string;
  auditorName: string;
  owningArea: string;
  vehicleNumber: string;
  plate: string;
  crew: AuditCrewMember[];
  sections: AuditSection[];
  status: AuditStatus;
  branchId: BranchId;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export type ShiftType = 'opening' | 'mid' | 'closing' | 'day-off' | 'pto' | 'sick';

/** Per-shift attendance, layered ON TOP of the roster (never overwrites shiftType):
 *  undefined = scheduled (unmarked) · 'present' = confirmed on shift · 'absent' = no-show/sick. */
export type Attendance = 'present' | 'absent';

/** True for shift types that occupy a full day with no scheduled start/end times. */
export function isFullDayShift(t: ShiftType): boolean {
  return t === 'day-off' || t === 'pto' || t === 'sick';
}

export interface Shift {
  id: string;
  userId: string;
  date: string;         // ISO date: '2026-04-23'
  startTime?: string;   // 24hr: '09:00' — undefined for day-off
  endTime?: string;     // 24hr: '17:00' — undefined for day-off
  shiftType: ShiftType;
  notes?: string;
  actualStartTime?: string; // actual hours worked
  actualEndTime?: string;
  isStat?: boolean;         // Manitoba stat holiday — all actual hours = OT
  attendance?: Attendance;  // who actually showed — undefined = scheduled (unmarked)
  ptoApproved?: boolean;    // for shiftType 'pto': false = requested, true = boss-approved
  ptoAlternateDate?: string; // ISO date — optional backup, only set when 'pto' falls on a stat
  createdAt: string;
  updatedAt: string;
  branchId: BranchId;
}

export interface ShiftWithUser extends Shift {
  user: {
    name: string;
    role: UserRole;
  };
}

// ── Issue Log ─────────────────────────────────────────────────────────────────

export type IssueSeverity = 'low' | 'medium' | 'high';

export interface FacilityIssue {
  id: string;
  branchId: string;
  title: string;
  description?: string;
  severity: IssueSeverity;
  reportedById: string;
  reportedAt: string;
  clearedById?: string;
  clearedAt?: string;
  notes?: string;
  photoUrl?: string;
  status: 'open' | 'resolved' | 'reopened';
  reopenCount: number;
}

// ── Washbay Log ───────────────────────────────────────────────────────────────

export interface WashbayLog {
  id: string;
  branchId: string;
  date: string;              // ISO date "2026-04-29"
  fullPages: number;         // Completed gas sheet pages (×19 each)
  lastPageEntries: number;   // Entries on the current/last page (0–19)
  carsRemaining: number;     // Left in queue at close
  cleanNotPickedUp: number;  // Clean cars on lot, not yet sent to airport
  nonRentablesFuelled: number; // Fuelled today (on gas sheet) but parked, not sent — subtracted from sent-to-fleet
  deferredCompletions: number; // Sent today but fuelled a prior day (plate install) — added to sent-to-fleet
  nonRentablesNote?: string | null; // Optional reason for the parked units (damage vs awaiting plates)
  carryOver: number;           // Vehicles inherited from previous shift's queue at shift start (informational)
  teamSize: number;          // VSAs on shift
  shiftHours: number;        // Hours washbay ran (default 8)
  overtimeHours: number;     // Extended operating hours beyond base (0–3)
  lotStatus: LotStatus;      // Lot state at end of closing shift
  airportFlipping: boolean;  // Manual attestation: quick turnarounds run at the airport today (lowers bay count)
  loggedById: string;        // User.id
  loggedAt: string;          // ISO timestamp
}

// ── Shift Checkpoints ──────────────────────────────────────────────────────────

export interface ShiftCheckpoint {
  id: string;
  branchId: string;
  date: string;           // ISO date: '2026-05-20'
  checkpointType: string; // 'closing_arrival'
  fullPages: number;
  lastPageEntries: number;
  loggedBy: string;       // user ID
  loggedAt: string;       // ISO timestamp
}

// ── Lost & Found ─────────────────────────────────────────────────────────────

export type LostFoundStatus = 'holding' | 'customer_contacted' | 'returned' | 'disposed';

export type LostFoundLocation =
  | 'visor'
  | 'front_seat'
  | 'back_seat'
  | 'trunk'
  | 'under_seat'
  | 'other';

export const LOST_FOUND_LOCATION_LABELS: Record<LostFoundLocation, string> = {
  visor:       'Visor',
  front_seat:  'Front',
  back_seat:   'Back',
  trunk:       'Trunk',
  under_seat:  'Under seat',
  other:       'Other',
};

export interface LostFoundItem {
  id: string;
  branchId: string;
  foundById: string;
  foundByName: string;
  foundAt: string;           // ISO timestamp — chain of custody anchor
  keyTagPhotoUrl?: string;
  itemPhotoUrl?: string;
  description?: string;
  location?: LostFoundLocation;
  licensePlate?: string;
  unitNumber?: string;
  vehicleMake?: string;
  status: LostFoundStatus;
  notes?: string;
  resolvedAt?: string;
  editedByName?: string;
  editedAt?: string;
}

// ── Vehicle Registry ──────────────────────────────────────────────────────────

export interface VehicleRegistryEntry {
  id: string;
  branchId: string;
  vehicleId?: string | null;
  plate?: string | null;
  unitNumber?: string | null;
  make?: string | null;
  model?: string | null;
  year?: number | null;
  color?: string | null;
  arrivedAt?: string | null;
  cleanedAt?: string | null;
  dispatchedAt?: string | null;
  needsReview: boolean;
  createdAt: string;
  date: string;
}

export type RegistryLookupResult =
  | { status: 'found';           entry: VehicleRegistryEntry }
  | { status: 'merge_candidate'; existing: VehicleRegistryEntry }
  | { status: 'not_found' };

// ── Off-Standard Time ─────────────────────────────────────────────────────────

export type OffStandardReason = 'CLASS' | 'WFW' | 'MTG' | 'WTH' | 'OTH';

export const OFF_STANDARD_LABELS: Record<OffStandardReason, { short: string; full: string }> = {
  CLASS: { short: 'CLASS', full: 'Training' },
  WFW:   { short: 'WFW',   full: 'Waiting for work' },
  MTG:   { short: 'MTG',   full: 'Meeting / Huddle' },
  WTH:   { short: 'WTH',   full: 'Weather' },
  OTH:   { short: 'OTH',   full: 'Other' },
};

export type OffStandardPresetReason = 'fleeting_cars' | 'fleeting_sent' | 'closing_duties' | 'opening_duties' | 'lot_organization' | 'edv' | 'customer_pickup' | 'airport_flip';

export const OFF_STANDARD_PRESET_LABELS: Record<OffStandardPresetReason, string> = {
  opening_duties:  'Opening Duties',
  closing_duties:  'Closing Duties',
  fleeting_cars:   'Fleeting Cars',
  fleeting_sent:   'Fleeting — Sent Up',
  lot_organization:'Lot Organization',
  edv:             'EDV',
  customer_pickup: 'Customer Pickup/Drop',
  airport_flip:    'Flipping Returns',
};

// Fleeting time that resulted in cars going up to fleet. Logged like any other
// off-standard entry, but excluded from the rate denominator — the shipped cars
// already count in sent-to-fleet, so relieving the time too would double-credit.
// Every other preset reduces the denominator normally (including plain
// `fleeting_cars`, which is prep that stayed on the lot).
export const SENT_UP_PRESET: OffStandardPresetReason = 'fleeting_sent';

export type OffStdEditStatus = 'pending' | 'approved' | 'denied';

export interface OffStandardEntry {
  id: string;
  startTime: string;
  stopTime: string;
  minutes: number;
  reason: OffStandardReason;
  explanation?: string;
  autoFromTrip: boolean;
  presetReason?: OffStandardPresetReason | null;
  linkedHoldId?: string | null;
  // edit & approval fields
  editedEndTime?:   string;
  editRequestedAt?: string;
  editRequestedBy?: string;
  editStatus?:      OffStdEditStatus | null;
  editReviewedBy?:  string;
  editReviewedAt?:  string;
  editStaffNote?:   string;
  // backdated entry fields
  isBackdated?:          boolean;
  backdateApprovedBy?:   string;
  backdateApprovedAt?:   string;
  // EDV no-match structured fields (only populated when no hold was auto-linked)
  edvPlate?:     string | null;
  edvExterior?:  boolean;
  edvInterior?:  boolean;
}
