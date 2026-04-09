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

export type VehicleStatus = 'IN_FLEET' | 'HELD' | 'OUT_ON_EXCEPTION' | 'RETURNED';

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

export interface Hold {
  id: string;
  vehicleId: string;
  damageDescription: string;
  flaggedById: string;     // User.id
  flaggedAt: string;       // ISO timestamp
  notes: string;
  status: HoldStatus;
  release?: Release;
}

// ── Releases ─────────────────────────────────────────────────────────────────

export interface Release {
  id: string;
  holdId: string;
  approvedById: string;    // User.id — Manager only
  approvedAt: string;      // ISO timestamp
  reason: string;
  expectedReturn: string;  // ISO date
  actualReturn?: string;   // ISO date — set when vehicle is returned
  notes: string;
}
