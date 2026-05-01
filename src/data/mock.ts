
import type { User, Vehicle, Hold, BranchConfig, BranchId } from '../types';

// ── Branch Configs ────────────────────────────────────────────────────────────
export const BRANCH_CONFIGS: Record<BranchId, BranchConfig> = {
  'YWG': { id: 'YWG', name: 'Airport (YWG)', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule', 'issue-log', 'manifest'] },
  'YWG-South': { id: 'YWG-South', name: 'Neighborhood (South)', enabledModules: ['fleet-garage', 'check-in', 'trips', 'manifest'] },
  'YYC': { id: 'YYC', name: 'Calgary (YYC)', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule', 'issue-log', 'manifest'] },
  'YVR': { id: 'YVR', name: 'Vancouver (YVR)', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule', 'issue-log', 'manifest'] },
  'ALL': { id: 'ALL', name: 'All Branches', enabledModules: ['fleet-garage', 'trips', 'check-in', 'inventory', 'lost-and-found', 'audits', 'analytics', 'schedule', 'issue-log', 'manifest'] }
};


// ── Demo Users ────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  { id: 'u1', employeeId: '331965',  name: 'Aaron S.',    role: 'VSA',                password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u2', employeeId: 'VSA-002', name: 'DiZee',       role: 'Lead VSA',           password: '!Bananarama1982', branchId: 'YWG-South' },
  { id: 'u3', employeeId: 'VSA-003', name: 'Belle',       role: 'VSA',                password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u4', employeeId: 'CSR-001', name: 'CoZee',       role: 'CSR',                password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u5', employeeId: 'HIR-001', name: 'Tori',        role: 'Branch Manager',     password: '!Bananarama1982', branchId: 'YWG-South' },
  { id: 'u6', employeeId: 'MGR-001', name: 'ZeeRah',      role: 'Branch Manager',     password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u7', employeeId: 'OPS-001', name: 'Zee',         role: 'Operations Manager', password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u8', employeeId: 'DRV-001', name: 'GenZee',      role: 'Driver',             password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u9', employeeId: 'DRV-002', name: 'ZeeDric',     role: 'Driver',             password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u10', employeeId: 'VSA-004', name: 'PerplexiZee', role: 'VSA',               password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u11', employeeId: '256163',  name: 'Geoff N.',    role: 'Lead VSA',                password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u12', employeeId: '300210',  name: 'Ray T.',      role: 'VSA',               password: '!Bananarama1982', branchId: 'YWG' },
  { id: 'u13', employeeId: 'BOSS',    name: 'Big Boss',    role: 'City Manager',       password: '!Bananarama1982', branchId: 'ALL' },
  { id: 'u14', employeeId: 'YYC-VSA-01', name: 'Marcus L.',   role: 'VSA',                password: '!Bananarama1982', branchId: 'YYC' },
  { id: 'u15', employeeId: 'YVR-VSA-01', name: 'Linh T.',     role: 'VSA',                password: '!Bananarama1982', branchId: 'YVR' },
];

// ── Demo Vehicles ─────────────────────────────────────────────────────────────

export const VEHICLES: Vehicle[] = [
  {
    id: 'v1',
    unitNumber: 'HRZ-4821',
    licensePlate: 'GHK 294',
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    color: 'Silver',
    status: 'HELD',
    branchId: 'YWG',
  },
  {
    id: 'v2',
    unitNumber: 'HRZ-3307',
    licensePlate: 'JFT 881',
    make: 'Chevrolet',
    model: 'Malibu',
    year: 2023,
    color: 'White',
    status: 'OUT_ON_EXCEPTION',
    branchId: 'YWG',
  },
  {
    id: 'v3',
    unitNumber: 'HRZ-5590',
    licensePlate: 'KLP 447',
    make: 'Ford',
    model: 'Escape',
    year: 2021,
    color: 'Black',
    status: 'RETURNED',
    branchId: 'YWG',
  },
  {
    id: 'v7',
    unitNumber: '5513130',
    licensePlate: 'LJF684',
    make: 'Tesla',
    model: 'Model Y',
    year: 2022,
    color: 'Black',
    status: 'HELD',
    branchId: 'YWG',
  },
  {
    id: 'v5',
    unitNumber: 'HRZ-2298',
    licensePlate: 'PBX 773',
    make: 'Hyundai',
    model: 'Elantra',
    year: 2022,
    color: 'Red',
    status: 'HELD',
    branchId: 'YWG-South',
  },
  // ── One-way arrivals from out-of-province (cross-branch demo) ──────────
  {
    id: 'v8',
    unitNumber: 'HRZ-7142',
    licensePlate: 'ABK 502',
    make: 'Nissan',
    model: 'Rogue',
    year: 2023,
    color: 'White',
    status: 'HELD',
    branchId: 'YWG',
  },
  {
    id: 'v9',
    unitNumber: 'HRZ-8819',
    licensePlate: 'BCP 224',
    make: 'Kia',
    model: 'Sportage',
    year: 2023,
    color: 'Grey',
    status: 'HELD',
    branchId: 'YWG',
  },
];

// ── Demo Holds ────────────────────────────────────────────────────────────────

export const HOLDS: Hold[] = [
  // v1 — HRZ-4821 — Currently HELD (active hold, no release)
  {
    id: 'h1',
    vehicleId: 'v1',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Deep scratch on driver-side rear door. Paint chipped to metal. Approx 8 inches.',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-05T14:22:00',
    notes: 'Customer denied damage at return. Documented on lot before next rental.',
    status: 'ACTIVE',
    branchId: 'YWG',
  },

  // v2 — HRZ-3307 — OUT ON EXCEPTION (hold was released by manager)
  {
    id: 'h2',
    vehicleId: 'v2',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Cracked windshield — passenger side. Spider crack from lower corner, approx 14 inches.',
    flaggedById: 'u3', // Belle
    flaggedAt: '2026-03-28T09:10:00',
    notes: 'Flagged before lot went to critical shortage. Repair appointment scheduled for Apr 12.',
    status: 'RELEASED',
    branchId: 'YWG-South',
    release: {
      id: 'r1',
      holdId: 'h2',
      approvedById: 'u6', // ZeeRah (Branch Manager)
      approvedAt: '2026-03-29T11:45:00',
      releaseType: 'EXCEPTION' as const,
      releaseMethod: 'standard' as const,
      reason: 'Fleet shortage — critical rental demand. Windshield does not affect drivability. Customer informed and accepted.',
      expectedReturn: '2026-04-08',
      notes: 'Customer signed exception waiver. Vehicle must return by Apr 8 for scheduled repair.',
    },
  },

  // v3 — HRZ-5590 — RETURNED (full cycle: held → released → returned)
  {
    id: 'h3',
    vehicleId: 'v3',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Front bumper damage — passenger side. Impact dent with cracked housing. Turn signal intact.',
    flaggedById: 'u2', // DiZee
    flaggedAt: '2026-03-10T16:05:00',
    notes: 'Vehicle returned from 3-week rental. Damage not on pre-rental inspection sheet.',
    status: 'RETURNED',
    branchId: 'YWG',
    release: {
      id: 'r2',
      holdId: 'h3',
      approvedById: 'u7', // Zee (Operations Manager)
      approvedAt: '2026-03-12T08:30:00',
      releaseType: 'EXCEPTION' as const,
      releaseMethod: 'standard' as const,
      reason: 'High-demand weekend. Bumper damage is cosmetic only. Customer accepted vehicle condition.',
      expectedReturn: '2026-03-17',
      actualReturn: '2026-03-16',
      notes: 'Returned one day early. Bumper replaced Mar 19.',
    },
  },

  // v3 — HRZ-5590 — Second hold (repeat offender — this vehicle has history)
  {
    id: 'h4',
    vehicleId: 'v3',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Interior — rear seat. Beverage stain, passenger side. Detailing could not fully remove.',
    flaggedById: 'u4', // CoZee (CSR)
    flaggedAt: '2026-02-14T13:45:00',
    notes: 'Customer returned late. Stain noticed during check-in. Photos taken.',
    status: 'RETURNED',
    branchId: 'YWG',
    release: {
      id: 'r3',
      holdId: 'h4',
      approvedById: 'u6', // ZeeRah
      approvedAt: '2026-02-15T10:20:00',
      releaseType: 'EXCEPTION' as const,
      releaseMethod: 'standard' as const,
      reason: 'Interior cosmetic issue only. Fleet shortage. Vehicle cleared for rental.',
      expectedReturn: '2026-02-18',
      actualReturn: '2026-02-19',
      notes: 'Returned one day late. Seat professionally cleaned Feb 21.',
    },
  },

  // v5 — HRZ-2298 — Currently HELD
  {
    id: 'h5',
    vehicleId: 'v5',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Missing driver-side mirror cap. Mirror glass intact. Clip housing broken.',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-07T08:55:00',
    notes: 'Noticed during lot walk. Not on last return inspection. Part ordered.',
    status: 'ACTIVE',
    branchId: 'YWG',
  },

  // v7 — 5513130 (Tesla Model Y) — RETURNED hold, damage let go twice before
  {
    id: 'h6',
    vehicleId: 'v7',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Dent — major / crumple',
    flaggedById: 'u3', // Belle (HIR)
    flaggedAt: '2025-11-14T10:20:00',
    notes: 'Rear liftgate / bumper area. Impact dent, no paint break. Previously documented.',
    status: 'RETURNED',
    branchId: 'YWG',
    release: {
      id: 'r4',
      holdId: 'h6',
      approvedById: 'u6', // ZeeRah (Branch Manager)
      approvedAt: '2025-11-15T09:00:00',
      releaseType: 'EXCEPTION' as const,
      releaseMethod: 'standard' as const,
      reason: 'Cosmetic only. Fleet at critical shortage. Customer accepted known damage.',
      expectedReturn: '2025-11-20',
      actualReturn: '2025-11-19',
      notes: 'Customer signed exception waiver. Damage pre-dates current rental cycle.',
    },
  },

  // v7 — 5513130 — Currently HELD again (same dent, re-flagged by Aaron)
  {
    id: 'h7',
    vehicleId: 'v7',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Dent — major / crumple',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-08T11:30:00',
    notes: 'Same rear liftgate dent. Pre-existing — has been on this vehicle for months. Flagging again for new staff awareness.',
    status: 'ACTIVE',
    branchId: 'YWG',
  },

  // ── Cross-province one-way arrivals ────────────────────────────────────
  // v8 — HRZ-7142 — Pre-existing damage flagged at YYC, vehicle transferred to YWG
  {
    id: 'h8',
    vehicleId: 'v8',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Front bumper scrape — passenger side. Cosmetic, paint scuffed, no structural damage. Approx 6 inches.',
    flaggedById: 'u14', // Marcus L. (Calgary VSA)
    flaggedAt: '2026-04-05T11:20:00',
    notes: 'Customer return scrape at YYC. Hold remains active during inter-branch transfer to YWG for inventory rebalancing. YWG team to verify match on arrival — do not flag as new.',
    status: 'ACTIVE',
    branchId: 'YYC',
  },

  // v9 — HRZ-8819 — Clean at YVR, fresh damage discovered on YWG arrival
  {
    id: 'h9',
    vehicleId: 'v9',
    holdTypes: ['damage'], holdType: 'damage' as const,
    damageDescription: 'Rear quarter panel dent — driver side. Impact dent, no paint break. Approx 4 inches diameter.',
    flaggedById: 'u3', // Belle (YWG VSA)
    flaggedAt: '2026-04-14T09:45:00',
    notes: 'Discovered during arrival inspection of YVR one-way customer drop-off. Vehicle was clean at YVR origin (last check-in by Linh T., Apr 12 — exterior clean, no holds). Damage occurred during rental — new flag.',
    status: 'ACTIVE',
    branchId: 'YWG',
  },
];
