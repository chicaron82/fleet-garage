// ── Roles ────────────────────────────────────────────────────────────────────

export type UserRole = 'VSA' | 'Lead VSA' | 'CSR' | 'HIR' | 'Branch Manager' | 'Operations Manager';

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

export type VehicleStatus = 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED' | 'PRE_EXISTING';

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

export type HoldStatus = 'ACTIVE' | 'RELEASED' | 'RETURNED';
export type HoldType = 'damage' | 'detail';
export type DetailReason = 'too-dirty' | 'pet-hair' | 'smoke-vape';

export const DETAIL_REASON_LABELS: Record<DetailReason, string> = {
  'too-dirty': 'Too dirty',
  'pet-hair':  'Pet hair',
  'smoke-vape': 'Smoke / vape',
};

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
  release?: Release;
}

// ── Releases ─────────────────────────────────────────────────────────────────

export type ReleaseType = 'EXCEPTION' | 'PRE_EXISTING';

export interface Release {
  id: string;
  holdId: string;
  approvedById: string;      // User.id — Manager only
  approvedAt: string;        // ISO timestamp
  releaseType: ReleaseType;
  reason: string;
  expectedReturn?: string;   // ISO date — required for EXCEPTION, omitted for PRE_EXISTING
  actualReturn?: string;     // ISO date — set when vehicle is returned
  notes: string;
}
