import { describe, it, expect } from 'vitest';
import { buildRosterStaff } from './rosterStaff';

describe('buildRosterStaff', () => {
  it('builds a roster-only profile with a fake ROSTER- employee id', () => {
    const p = buildRosterStaff({ name: 'Marisol', role: 'VSA', branchId: 'YWG' }, 'abcd1234-ef56-7890-abcd-ef1234567890');
    expect(p.rosterOnly).toBe(true);
    expect(p.id).toBe('abcd1234-ef56-7890-abcd-ef1234567890');
    expect(p.name).toBe('Marisol');
    expect(p.role).toBe('VSA');
    expect(p.branchId).toBe('YWG');
    expect(p.employeeId).toBe('ROSTER-ABCD1234'); // first 8 of the uuid, upper
  });
  it('trims the name', () => {
    expect(buildRosterStaff({ name: '  Dee  ', role: 'Driver', branchId: 'YWG' }).name).toBe('Dee');
  });
  it('generates a unique id when none is injected', () => {
    const a = buildRosterStaff({ name: 'A', role: 'VSA', branchId: 'YWG' });
    const b = buildRosterStaff({ name: 'B', role: 'VSA', branchId: 'YWG' });
    expect(a.id).not.toBe(b.id);
    expect(a.employeeId.startsWith('ROSTER-')).toBe(true);
  });
});
