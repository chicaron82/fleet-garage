// ── Core Types ─────────────────────────────────────────────────────────────────

export type Module = 'fleet-garage' | 'movement-log' | 'check-in' | 'inventory' | 'lost-and-found' | 'audits' | 'analytics' | 'schedule' | 'issue-log' | 'manifest';

export type BranchId = 'YWG' | 'YWG-South' | 'YYC' | 'YVR' | 'ALL';

export interface BranchConfig {
  id: BranchId;
  name: string;
  enabledModules: Module[];
}

// ── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'VSA' | 'Lead VSA' | 'CSR' | 'HIR' | 'Branch Manager' | 'Operations Manager' | 'City Manager' | 'Driver';

export const CAN_RELEASE: UserRole[] = ['Branch Manager', 'Operations Manager', 'City Manager'];

export function canRelease(role: UserRole): boolean {
  return CAN_RELEASE.includes(role);
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

export type VehicleStatus = 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED' | 'PRE_EXISTING' | 'CLEAR';

export interface Vehicle {
  id: string;
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
  status: VehicleStatus;
  branchId: BranchId;
}

// ── Holds ────────────────────────────────────────────────────────────────────

export type HoldStatus = 'ACTIVE' | 'RELEASED' | 'RETURNED' | 'REPAIRED';
export type HoldType = 'damage' | 'detail' | 'mechanical';
export type DetailReason = 'too-dirty' | 'pet-hair' | 'smoke-vape';

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

export interface Repair {
  id: string;
  holdId: string;
  repairedById: string;   // User.id — Manager only
  repairedAt: string;     // ISO timestamp
  notes: string;
}

// ── Handoff Notes ─────────────────────────────────────────────────────────────

export type LotStatus = 'zeroed' | 'manageable' | 'backlog';

export interface HandoffNote {
  id: string;
  branchId: string;
  loggedById: string;
  loggedByName: string;
  loggedAt: string;
  dirtiesInQueue: number;
  cleansAtAirport: number;
  expectedReturns?: string;
  notes?: string;
  lotStatus: LotStatus;
}

// ── Scanner ───────────────────────────────────────────────────────────────────

export interface ScannedPayload {
  unitNumber: string;
  licensePlate: string;
  make: string;
  model: string;
  year: number;
  color: string;
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
  | { name: 'manifest' };

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
  crew: AuditCrew;
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
  loggedById: string;        // User.id
  loggedAt: string;          // ISO timestamp
}

// ── Off-Standard Time ─────────────────────────────────────────────────────────

export type OffStandardReason = 'CLASS' | 'WFW' | 'MTG' | 'WTH' | 'OTH';

export const OFF_STANDARD_LABELS: Record<OffStandardReason, { short: string; full: string }> = {
  CLASS: { short: 'CLASS', full: 'Training' },
  WFW:   { short: 'WFW',   full: 'Waiting for work' },
  MTG:   { short: 'MTG',   full: 'Meeting / Huddle' },
  WTH:   { short: 'WTH',   full: 'Weather' },
  OTH:   { short: 'OTH',   full: 'Other' },
};

export interface OffStandardEntry {
  id: string;
  startTime: string;       // ISO timestamp
  stopTime: string;        // ISO timestamp
  minutes: number;
  reason: OffStandardReason;
  explanation?: string;
  autoFromTrip: boolean;   // true = locked, came from movement log
}
