import { describe, it, expect } from 'vitest';
import { SCHEDULE_GROUPS } from '../../src/lib/scheduleGroups';

describe('SCHEDULE_GROUPS', () => {
  it('⭐ Floor, Drivers, Counter — the pill order Aaron asked for, which is also the grid order', () => {
    expect(SCHEDULE_GROUPS.map(g => g.id)).toEqual(['floor', 'drivers', 'counter']);
  });

  it('counter carries the Lead CSR first, then CSRs, then HIRs', () => {
    expect(SCHEDULE_GROUPS.find(g => g.id === 'counter')!.roles).toEqual(['Lead CSR', 'CSR', 'HIR']);
  });

  it('floor is VSAs, drivers is Drivers', () => {
    const floor = SCHEDULE_GROUPS.find(g => g.id === 'floor')!;
    const drivers = SCHEDULE_GROUPS.find(g => g.id === 'drivers')!;
    expect(floor.roles).toEqual(['VSA', 'Lead VSA']);
    expect(drivers.roles).toEqual(['Driver']);
  });

  it('intentionally excludes management roles from every group', () => {
    const allRoles = SCHEDULE_GROUPS.flatMap(g => g.roles);
    expect(allRoles).not.toContain('Branch Manager');
    expect(allRoles).not.toContain('Operations Manager');
  });
});
