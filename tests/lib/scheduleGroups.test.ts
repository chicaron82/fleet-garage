import { describe, it, expect } from 'vitest';
import { SCHEDULE_GROUPS } from '../../src/lib/scheduleGroups';

describe('SCHEDULE_GROUPS', () => {
  it('has floor, counter, and drivers groups', () => {
    expect(SCHEDULE_GROUPS.map(g => g.id)).toEqual(['floor', 'counter', 'drivers']);
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
