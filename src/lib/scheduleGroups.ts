import type { UserRole } from '../types';

export type ScheduleGroup = 'floor' | 'counter' | 'drivers';

// ⭐ THIS ORDER IS THE GRID'S ORDER TOO — `rosterRank` sorts schedule rows by index in this list, so the
// pills and the rows can never disagree. Aaron, 2026-09-14: *"the pills are Floor, Counter, Drivers..
// can we rearrange it to Floor, Drivers, Counter?"* Drivers sit beside the floor they feed; Larry C's
// shaded row seams floor→drivers and the Lead CSR's seams drivers→counter.

export const SCHEDULE_GROUPS: {
  id: ScheduleGroup;
  label: string;
  roles: UserRole[];
}[] = [
  { id: 'floor',   label: 'Floor',   roles: ['VSA', 'Lead VSA'] },
  { id: 'drivers', label: 'Drivers', roles: ['Driver'] },
  { id: 'counter', label: 'Counter', roles: ['Lead CSR', 'CSR', 'HIR'] },
  // Branch Manager and Operations Manager intentionally excluded
];
