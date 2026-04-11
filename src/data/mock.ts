import type { User, Vehicle, Hold } from '../types';

// ── Demo Users ────────────────────────────────────────────────────────────────

export const USERS: User[] = [
  { id: 'u1', employeeId: '331965',  name: 'Aaron S.',    role: 'VSA',                password: '!Bananarama1982' },
  { id: 'u2', employeeId: 'VSA-002', name: 'DiZee',       role: 'Lead VSA',           password: '!Bananarama1982' },
  { id: 'u3', employeeId: 'VSA-003', name: 'Belle',       role: 'HIR',                password: '!Bananarama1982' },
  { id: 'u4', employeeId: 'CSR-001', name: 'CoZee',       role: 'CSR',                password: '!Bananarama1982' },
  { id: 'u5', employeeId: 'HIR-001', name: 'Tori',        role: 'HIR',                password: '!Bananarama1982' },
  { id: 'u6', employeeId: 'MGR-001', name: 'ZeeRah',      role: 'Branch Manager',     password: '!Bananarama1982' },
  { id: 'u7', employeeId: 'OPS-001', name: 'Zee',         role: 'Operations Manager', password: '!Bananarama1982' },
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
  },
];

// ── Demo Holds ────────────────────────────────────────────────────────────────

export const HOLDS: Hold[] = [
  // v1 — HRZ-4821 — Currently HELD (active hold, no release)
  {
    id: 'h1',
    vehicleId: 'v1',
    holdType: 'damage' as const,
    damageDescription: 'Deep scratch on driver-side rear door. Paint chipped to metal. Approx 8 inches.',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-05T14:22:00',
    notes: 'Customer denied damage at return. Documented on lot before next rental.',
    status: 'ACTIVE',
  },

  // v2 — HRZ-3307 — OUT ON EXCEPTION (hold was released by manager)
  {
    id: 'h2',
    vehicleId: 'v2',
    holdType: 'damage' as const,
    damageDescription: 'Cracked windshield — passenger side. Spider crack from lower corner, approx 14 inches.',
    flaggedById: 'u3', // Belle
    flaggedAt: '2026-03-28T09:10:00',
    notes: 'Flagged before lot went to critical shortage. Repair appointment scheduled for Apr 12.',
    status: 'RELEASED',
    release: {
      id: 'r1',
      holdId: 'h2',
      approvedById: 'u6', // ZeeRah (Branch Manager)
      approvedAt: '2026-03-29T11:45:00',
      releaseType: 'EXCEPTION' as const,
      reason: 'Fleet shortage — critical rental demand. Windshield does not affect drivability. Customer informed and accepted.',
      expectedReturn: '2026-04-08',
      notes: 'Customer signed exception waiver. Vehicle must return by Apr 8 for scheduled repair.',
    },
  },

  // v3 — HRZ-5590 — RETURNED (full cycle: held → released → returned)
  {
    id: 'h3',
    vehicleId: 'v3',
    holdType: 'damage' as const,
    damageDescription: 'Front bumper damage — passenger side. Impact dent with cracked housing. Turn signal intact.',
    flaggedById: 'u2', // DiZee
    flaggedAt: '2026-03-10T16:05:00',
    notes: 'Vehicle returned from 3-week rental. Damage not on pre-rental inspection sheet.',
    status: 'RETURNED',
    release: {
      id: 'r2',
      holdId: 'h3',
      approvedById: 'u7', // Zee (Operations Manager)
      approvedAt: '2026-03-12T08:30:00',
      releaseType: 'EXCEPTION' as const,
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
    holdType: 'damage' as const,
    damageDescription: 'Interior — rear seat. Beverage stain, passenger side. Detailing could not fully remove.',
    flaggedById: 'u4', // CoZee (CSR)
    flaggedAt: '2026-02-14T13:45:00',
    notes: 'Customer returned late. Stain noticed during check-in. Photos taken.',
    status: 'RETURNED',
    release: {
      id: 'r3',
      holdId: 'h4',
      approvedById: 'u6', // ZeeRah
      approvedAt: '2026-02-15T10:20:00',
      releaseType: 'EXCEPTION' as const,
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
    holdType: 'damage' as const,
    damageDescription: 'Missing driver-side mirror cap. Mirror glass intact. Clip housing broken.',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-07T08:55:00',
    notes: 'Noticed during lot walk. Not on last return inspection. Part ordered.',
    status: 'ACTIVE',
  },

  // v7 — 5513130 (Tesla Model Y) — RETURNED hold, damage let go twice before
  {
    id: 'h6',
    vehicleId: 'v7',
    holdType: 'damage' as const,
    damageDescription: 'Dent — major / crumple',
    flaggedById: 'u3', // Belle (HIR)
    flaggedAt: '2025-11-14T10:20:00',
    notes: 'Rear liftgate / bumper area. Impact dent, no paint break. Previously documented.',
    status: 'RETURNED',
    release: {
      id: 'r4',
      holdId: 'h6',
      approvedById: 'u6', // ZeeRah (Branch Manager)
      approvedAt: '2025-11-15T09:00:00',
      releaseType: 'EXCEPTION' as const,
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
    holdType: 'damage' as const,
    damageDescription: 'Dent — major / crumple',
    flaggedById: 'u1', // Aaron S.
    flaggedAt: '2026-04-08T11:30:00',
    notes: 'Same rear liftgate dent. Pre-existing — has been on this vehicle for months. Flagging again for new staff awareness.',
    status: 'ACTIVE',
  },
];
