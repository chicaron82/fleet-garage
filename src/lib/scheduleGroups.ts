import type { UserRole } from '../types';

export type ScheduleGroup = 'floor' | 'counter' | 'drivers';

export const SCHEDULE_GROUPS: {
  id: ScheduleGroup;
  label: string;
  roles: UserRole[];
}[] = [
  { id: 'floor',   label: 'Floor',   roles: ['VSA', 'Lead VSA'] },
  { id: 'counter', label: 'Counter', roles: ['CSR', 'HIR'] },
  { id: 'drivers', label: 'Drivers', roles: ['Driver'] },
  // Branch Manager and Operations Manager intentionally excluded
];
