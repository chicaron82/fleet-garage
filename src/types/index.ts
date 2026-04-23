// ── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'VSA' | 'Lead VSA' | 'CSR' | 'HIR' | 'Branch Manager' | 'Operations Manager' | 'Driver';

export const CAN_RELEASE: UserRole[] = ['Branch Manager', 'Operations Manager'];

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
  holdType: HoldType;
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
}

// ── Releases ─────────────────────────────────────────────────────────────────

export type ReleaseType = 'EXCEPTION' | 'PRE_EXISTING';
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
  | { name: 'trips' }
  | { name: 'check-in' }
  | { name: 'inventory' }
  | { name: 'lost-and-found' }
  | { name: 'audits' }
  | { name: 'audit-form' }
  | { name: 'analytics' }
  | { name: 'schedule' };

export type Module = 'fleet-garage' | 'trips' | 'check-in' | 'inventory' | 'lost-and-found' | 'audits' | 'analytics' | 'schedule';

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
}
