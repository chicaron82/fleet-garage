// ── Vehicle Check-in Mock Data ────────────────────────────────────────────────

export type CheckInStatus = 'clean' | 'pending_washbay' | 'escalated' | 'pinned';

export interface WashbayReview {
  reviewedBy: string;
  reviewedAt: string;
  result: 'clean' | 'too_dirty' | 'damage_found' | 'odour' | 'pet_hair';
  notes: string;
}

export interface VehicleCheckIn {
  id: string;
  vehicleUnit: string;
  vehiclePlate: string;
  checkedInBy: string;
  checkedInAt: string;
  interiorCondition: 'clean' | 'questionable' | 'damaged';
  exteriorCondition: 'clean' | 'questionable' | 'damaged';
  photoCount: number;
  notes: string;
  status: CheckInStatus;
  washbayReview?: WashbayReview;
  expiresAt?: string;      // ISO date — null = pinned/no expiry
  pinnedBy?: string;       // Manager name who removed the expiry timer
  linkedHoldId?: string;   // Fleet Garage hold ID if escalated
}

const TODAY = '2026-04-14';

export const MOCK_CHECK_INS: VehicleCheckIn[] = [
  // ── Clean returns (auto-expire in 14 days) ─────────────────────────────
  {
    id: 'ci-1',
    vehicleUnit: 'HRZ-6012',
    vehiclePlate: 'MBK 331',
    checkedInBy: 'Belle',
    checkedInAt: `${TODAY}T08:45:00`,
    interiorCondition: 'clean',
    exteriorCondition: 'clean',
    photoCount: 4,
    notes: '',
    status: 'clean',
    expiresAt: '2026-04-28',
  },
  {
    id: 'ci-2',
    vehicleUnit: 'HRZ-3120',
    vehiclePlate: 'RXT 118',
    checkedInBy: 'CoZee',
    checkedInAt: `${TODAY}T09:20:00`,
    interiorCondition: 'clean',
    exteriorCondition: 'clean',
    photoCount: 4,
    notes: 'Minor dust on dash, nothing unusual.',
    status: 'clean',
    expiresAt: '2026-04-28',
  },
  {
    id: 'ci-3',
    vehicleUnit: 'HRZ-9981',
    vehiclePlate: 'JKL 720',
    checkedInBy: 'Belle',
    checkedInAt: `${TODAY}T10:05:00`,
    interiorCondition: 'clean',
    exteriorCondition: 'clean',
    photoCount: 4,
    notes: '',
    status: 'clean',
    expiresAt: '2026-04-28',
  },

  // ── Pending washbay review ─────────────────────────────────────────────
  {
    id: 'ci-4',
    vehicleUnit: 'HRZ-7845',
    vehiclePlate: 'NPC 442',
    checkedInBy: 'Tori',
    checkedInAt: `${TODAY}T11:30:00`,
    interiorCondition: 'questionable',
    exteriorCondition: 'clean',
    photoCount: 6,
    notes: 'Rear seat looks stained. Possible food spill. Leaving for washbay to assess after cleaning.',
    status: 'pending_washbay',
  },
  {
    id: 'ci-5',
    vehicleUnit: 'HRZ-4410',
    vehiclePlate: 'FGH 887',
    checkedInBy: 'CoZee',
    checkedInAt: `${TODAY}T12:15:00`,
    interiorCondition: 'questionable',
    exteriorCondition: 'clean',
    photoCount: 5,
    notes: 'Faint smoke smell on entry. Customer denied smoking. Leaving open for washbay to confirm.',
    status: 'pending_washbay',
  },

  // ── Escalated to Fleet Garage hold ─────────────────────────────────────
  {
    id: 'ci-6',
    vehicleUnit: 'HRZ-5501',
    vehiclePlate: 'BND 993',
    checkedInBy: 'Belle',
    checkedInAt: '2026-04-13T16:40:00',
    interiorCondition: 'clean',
    exteriorCondition: 'damaged',
    photoCount: 8,
    notes: 'Scratch along passenger side — not on pre-rental inspection. Flagged immediately.',
    status: 'escalated',
    linkedHoldId: 'h1',
    washbayReview: {
      reviewedBy: 'Aaron S.',
      reviewedAt: '2026-04-13T17:10:00',
      result: 'damage_found',
      notes: 'Confirmed deep scratch after wash. Paint chipped to metal. Flagged to Fleet Garage.',
    },
  },

  // ── Washbay caught issue post-wash ─────────────────────────────────────
  {
    id: 'ci-7',
    vehicleUnit: 'HRZ-3340',
    vehiclePlate: 'DRT 441',
    checkedInBy: 'Tori',
    checkedInAt: '2026-04-13T14:20:00',
    interiorCondition: 'questionable',
    exteriorCondition: 'clean',
    photoCount: 5,
    notes: 'Interior seemed fine at counter. Noted slight odour.',
    status: 'escalated',
    washbayReview: {
      reviewedBy: 'DiZee',
      reviewedAt: '2026-04-13T15:00:00',
      result: 'pet_hair',
      notes: 'Heavy pet hair in rear seats and trunk area. Discovered after initial vacuum. Needs full detail.',
    },
  },

  // ── Management-pinned (clean, but preserved for dispute) ───────────────
  {
    id: 'ci-8',
    vehicleUnit: 'HRZ-2055',
    vehiclePlate: 'WPG 554',
    checkedInBy: 'CoZee',
    checkedInAt: '2026-04-10T09:30:00',
    interiorCondition: 'clean',
    exteriorCondition: 'clean',
    photoCount: 4,
    notes: 'Customer disputed pre-existing scratch claim. Documented clean return as evidence.',
    status: 'pinned',
    pinnedBy: 'ZeeRah',
  },

  // ── Cross-province one-way arrivals ────────────────────────────────────
  // Pre-existing damage from Calgary — already on file, no new flag needed
  {
    id: 'ci-9',
    vehicleUnit: 'HRZ-7142',
    vehiclePlate: 'ABK 502',
    checkedInBy: 'Belle',
    checkedInAt: `${TODAY}T08:15:00`,
    interiorCondition: 'clean',
    exteriorCondition: 'damaged',
    photoCount: 6,
    notes: 'Inter-branch transfer arrival from Calgary (YYC). Front bumper scrape pre-existing — already flagged on hold h8 by Marcus L. on Apr 5. Verified match against YYC documentation. No new damage. Linked to existing YYC hold.',
    status: 'escalated',
    linkedHoldId: 'h8',
    washbayReview: {
      reviewedBy: 'DiZee',
      reviewedAt: `${TODAY}T08:45:00`,
      result: 'damage_found',
      notes: 'Confirmed damage matches Calgary documentation. Same scrape, same location, same dimensions. Hold h8 stays active under YYC branch — no new YWG hold needed.',
    },
  },

  // Clean at Vancouver — fresh damage discovered on Winnipeg arrival
  {
    id: 'ci-10',
    vehicleUnit: 'HRZ-8819',
    vehiclePlate: 'BCP 224',
    checkedInBy: 'Belle',
    checkedInAt: `${TODAY}T09:30:00`,
    interiorCondition: 'clean',
    exteriorCondition: 'damaged',
    photoCount: 7,
    notes: 'Customer one-way arrival from Vancouver (YVR). Vehicle was clean at YVR origin per Linh T.\'s check-in on Apr 12 — exterior clean, no holds. Fresh dent discovered on rear quarter panel during arrival inspection. New damage hold flagged at YWG.',
    status: 'escalated',
    linkedHoldId: 'h9',
    washbayReview: {
      reviewedBy: 'Aaron S.',
      reviewedAt: `${TODAY}T10:05:00`,
      result: 'damage_found',
      notes: 'Confirmed new damage. No matching record at Vancouver origin — clean check-in on file. Damage occurred during rental. Hold h9 created under YWG branch.',
    },
  },
];
