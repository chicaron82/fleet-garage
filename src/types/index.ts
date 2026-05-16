// ── Core Types ─────────────────────────────────────────────────────────────────

export type Module = 'fleet-garage' | 'movement-log' | 'check-in' | 'inventory' | 'lost-and-found' | 'audits' | 'analytics' | 'schedule' | 'issue-log' | 'manifest' | 'fleet-master';

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

const CAN_LOG_HANDOFF: UserRole[] = ['VSA', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canLogHandoff(role: UserRole): boolean {
  return CAN_LOG_HANDOFF.includes(role);
}

const CAN_ACTION_LOST_FOUND: UserRole[] = ['CSR', 'Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canActionLostFound(role: UserRole): boolean {
  return CAN_ACTION_LOST_FOUND.includes(role);
}

const CAN_WRITE_WHITEBOARD: UserRole[] = ['Lead VSA', 'Branch Manager', 'Operations Manager', 'City Manager', 'AGM', 'GM'];

export function canWriteWhiteboard(role: UserRole): boolean {
  return CAN_WRITE_WHITEBOARD.includes(role);
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
  password: string; // demo only — plaintext fine for POC
  branchId: BranchId;
}

// ── Vehicles ─────────────────────────────────────────────────────────────────

export type VehicleStatus    = 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED' | 'PRE_EXISTING' | 'CLEAR';
export type EvAssetStatus    = 'present' | 'missing';
export type VehicleEditStatus = 'pending' | 'approved' | 'denied';

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
  coverPhotoUrl?: string;
  archivedAt?: string;
  archivedById?: string;
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
  return ['Branch Manager', 'Operations Manager', 'City Manager'].includes(role);
}

// ── Holds ────────────────────────────────────────────────────────────────────

export type HoldStatus = 'ACTIVE' | 'RELEASED' | 'RETURNED' | 'REPAIRED';
export type HoldType = 'damage' | 'detail' | 'mechanical';
export type DetailReason = 'too-dirty' | 'pet-hair' | 'smoke-vape';
export type MechanicalSubType = 'tire-swap' | 'tire-repair' | 'pm-due' | 'other';

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
  detailReason?: DetailReason;
  mechanicalSubType?: MechanicalSubType | null;
  damageDescription: string;   // for damage holds; "Detail required — X" for detail holds
  flaggedById: string;         // User.id
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

export type Screen =
  | { name: 'dashboard' }
  | { name: 'vehicle'; vehicleId: string }
  | { name: 'new-hold'; vehicleId?: string; fromRegister?: boolean }
  | { name: 'register-vehicle'; fromHold?: boolean; prefill?: string }
  | { name: 'movement-log' }
  | { name: 'check-in' }
  | { name: 'inventory' }
  | { name: 'lost-and-found' }
  | { name: 'audits' }
  | { name: 'audit-form' }
  | { name: 'analytics' }
  | { name: 'schedule' }
  | { name: 'issue-log' }
  | { name: 'manifest' }
  | { name: 'fleet-master' };

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
  teamSize: number;          // VSAs on shift
  shiftHours: number;        // Hours washbay ran (default 8)
  overtimeHours: number;     // Extended operating hours beyond base (0–3)
  loggedById: string;        // User.id
  loggedAt: string;          // ISO timestamp
}

// ── Check-in Condition ────────────────────────────────────────────────────────

export type ConditionRating = 'clean' | 'good' | 'questionable' | 'escalated';

export type CheckInRouting = 'flip' | 'washbay' | 'review' | 'escalated';

export function deriveRouting(interior: ConditionRating, exterior: ConditionRating): CheckInRouting {
  if (interior === 'escalated' || exterior === 'escalated') return 'escalated';
  if (interior === 'questionable' || exterior === 'questionable') return 'review';
  if (interior === 'clean' && exterior === 'clean') return 'flip';
  return 'washbay';
}

// ── Lost & Found ─────────────────────────────────────────────────────────────

export type LostFoundStatus = 'holding' | 'customer_contacted' | 'returned';

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

export type OffStandardPresetReason = 'fleeting_cars' | 'closing_duties' | 'opening_duties' | 'lot_organization' | 'edv' | 'customer_pickup';

export const OFF_STANDARD_PRESET_LABELS: Record<OffStandardPresetReason, string> = {
  opening_duties:  'Opening Duties',
  closing_duties:  'Closing Duties',
  fleeting_cars:   'Fleeting Cars',
  lot_organization:'Lot Organization',
  edv:             'EDV',
  customer_pickup: 'Customer Pickup/Drop',
};

export type OthEditStatus = 'pending' | 'approved' | 'denied';

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
  editStatus?:      OthEditStatus | null;
  editReviewedBy?:  string;
  editReviewedAt?:  string;
  editStaffNote?:   string;
}
