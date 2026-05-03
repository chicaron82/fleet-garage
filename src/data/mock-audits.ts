import type { AuditRecord, AuditCheckItem } from '../types';

const pass = (id: string, label: string): AuditCheckItem => ({ id, label, result: 'pass' });
const fail = (id: string, label: string, photoUrl?: string): AuditCheckItem => ({ id, label, result: 'fail', photoUrl });

function section(id: string, label: string, items: AuditCheckItem[]): AuditRecord['sections'][number] {
  return { id, label, items, notes: '', isOpen: false };
}

export const MOCK_AUDITS: AuditRecord[] = [
  // 1 — Full pass
  {
    id: 'audit-001',
    date: '2026-04-14T08:32:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line A',
    vehicleNumber: 'HRZ-4821',
    plate: 'GHK 294',
    crew: [
      { employeeId: '', name: 'Aaron S.',    position: 'driver-side' },
      { employeeId: '', name: 'Belle',       position: 'passenger-side' },
      { employeeId: '', name: 'PerplexiZee', position: 'sprayer-prep' },
    ],
    status: 'PASSED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 2 — Fail on odor
  {
    id: 'audit-002',
    date: '2026-04-13T14:15:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line B',
    vehicleNumber: 'HRZ-3307',
    plate: 'JFT 881',
    crew: [
      { employeeId: '', name: 'PerplexiZee', position: 'driver-side' },
      { employeeId: '', name: 'Aaron S.',    position: 'passenger-side' },
      { employeeId: '', name: 'Belle',       position: 'sprayer-prep' },
    ],
    status: 'FAILED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [fail('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 3 — Full pass
  {
    id: 'audit-003',
    date: '2026-04-12T09:05:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line A',
    vehicleNumber: 'HRZ-5590',
    plate: 'KLP 447',
    crew: [
      { employeeId: '', name: 'Belle',       position: 'driver-side' },
      { employeeId: '', name: 'PerplexiZee', position: 'passenger-side' },
      { employeeId: '', name: 'Aaron S.',    position: 'sprayer-prep' },
    ],
    status: 'PASSED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 4 — Fail on damage + tread depth (Tesla)
  {
    id: 'audit-004',
    date: '2026-04-11T16:48:00',
    auditorName: 'DiZee',
    owningArea: 'Premium Bay',
    vehicleNumber: '5513130',
    plate: 'LJF684',
    crew: [
      { employeeId: '', name: 'Aaron S.',    position: 'driver-side' },
      { employeeId: '', name: 'PerplexiZee', position: 'passenger-side' },
      { employeeId: '', name: 'Belle',       position: 'sprayer-prep' },
    ],
    status: 'FAILED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), fail('dmg', 'Damage'), pass('whl', 'Wheels'), fail('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 5 — Full pass
  {
    id: 'audit-005',
    date: '2026-04-10T11:20:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line A',
    vehicleNumber: 'HRZ-2298',
    plate: 'PBX 773',
    crew: [
      { employeeId: '', name: 'Belle',       position: 'driver-side' },
      { employeeId: '', name: 'Aaron S.',    position: 'passenger-side' },
      { employeeId: '', name: 'PerplexiZee', position: 'sprayer-prep' },
    ],
    status: 'PASSED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 6 — Full pass
  {
    id: 'audit-006',
    date: '2026-04-09T07:55:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line B',
    vehicleNumber: 'HRZ-4821',
    plate: 'GHK 294',
    crew: [
      { employeeId: '', name: 'PerplexiZee', position: 'driver-side' },
      { employeeId: '', name: 'Belle',       position: 'passenger-side' },
      { employeeId: '', name: 'Aaron S.',    position: 'sprayer-prep' },
    ],
    status: 'PASSED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },

  // 7 — Full pass
  {
    id: 'audit-007',
    date: '2026-04-08T13:30:00',
    auditorName: 'DiZee',
    owningArea: 'Ready Line A',
    vehicleNumber: 'HRZ-3307',
    plate: 'JFT 881',
    crew: [
      { employeeId: '', name: 'Aaron S.',    position: 'driver-side' },
      { employeeId: '', name: 'Belle',       position: 'passenger-side' },
      { employeeId: '', name: 'PerplexiZee', position: 'sprayer-prep' },
    ],
    status: 'PASSED',
    branchId: 'YWG',
    sections: [
      section('exterior', 'EXTERIOR', [pass('ext', 'Exterior'), pass('dmg', 'Damage'), pass('whl', 'Wheels'), pass('trd', 'Tread Depth')]),
      section('interior', 'INTERIOR', [pass('odr', 'Odor'), pass('fuel', 'Fuel'), pass('seats', 'Seats'), pass('under', 'Under Seats'), pass('cup', 'Cup Holders'), pass('mir', 'Mirror / Glass')]),
      section('misc', 'MISC', [pass('trunk', 'Trunk'), pass('glove', 'Glove Box')]),
    ],
  },
];
