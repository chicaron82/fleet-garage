import { describe, it, expect } from 'vitest';
import { buildRosterStaff } from '../../src/lib/rosterStaff';

const ID = 'abcdef12-3456-7890-abcd-ef1234567890';

describe('buildRosterStaff', () => {
  it('builds a roster-only profile with the injected id', () => {
    const p = buildRosterStaff({ name: 'Jordan', role: 'VSA', branchId: 'YWG' }, ID);
    expect(p.id).toBe(ID);
    expect(p.name).toBe('Jordan');
    expect(p.role).toBe('VSA');
    expect(p.branchId).toBe('YWG');
    expect(p.rosterOnly).toBe(true);
  });

  it('mints a ROSTER- employee id from the first 8 id chars, upper-cased', () => {
    const p = buildRosterStaff({ name: 'Jordan', role: 'VSA', branchId: 'YWG' }, ID);
    expect(p.employeeId).toBe('ROSTER-ABCDEF12');
  });

  it('trims the name', () => {
    const p = buildRosterStaff({ name: '  Sam  ', role: 'Lead VSA', branchId: 'YWG' }, ID);
    expect(p.name).toBe('Sam');
  });

  it('falls back to a generated uuid when none is injected', () => {
    const p = buildRosterStaff({ name: 'Sam', role: 'VSA', branchId: 'YWG' });
    expect(p.id).toMatch(/[0-9a-f-]{36}/);
    expect(p.employeeId).toMatch(/^ROSTER-[0-9A-F]{8}$/);
  });
});
