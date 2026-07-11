import { describe, it, expect } from 'vitest';
import { isRealAccount, isMockPersona } from '../../src/lib/accountClassification';

describe('isRealAccount', () => {
  it('is true only for the three real production employee ids', () => {
    expect(isRealAccount('331965')).toBe(true); // Aaron
    expect(isRealAccount('300210')).toBe(true); // Ray
    expect(isRealAccount('256163')).toBe(true); // Geoff
  });
  it('is false for demo personas, roster ids, and blanks', () => {
    expect(isRealAccount('VSA-002')).toBe(false);
    expect(isRealAccount('ROSTER-E262CCF8')).toBe(false);
    expect(isRealAccount('')).toBe(false);
    expect(isRealAccount(null)).toBe(false);
    expect(isRealAccount(undefined)).toBe(false);
  });
});

describe('isMockPersona', () => {
  it('flags a demo persona — neither real crew nor roster staff', () => {
    expect(isMockPersona({ employeeId: 'VSA-002', rosterOnly: false })).toBe(true);  // DiZee
    expect(isMockPersona({ employeeId: 'CSR-001', rosterOnly: false })).toBe(true);  // CoZee
    expect(isMockPersona({ employeeId: 'GM-001',  rosterOnly: false })).toBe(true);  // Howard
  });
  it('keeps real production crew', () => {
    expect(isMockPersona({ employeeId: '331965', rosterOnly: false })).toBe(false); // Aaron
    expect(isMockPersona({ employeeId: '256163', rosterOnly: false })).toBe(false); // Geoff
  });
  it('keeps roster ghosts — real floor staff who just do not log in', () => {
    expect(isMockPersona({ employeeId: 'ROSTER-E262CCF8', rosterOnly: true })).toBe(false); // Erick
    expect(isMockPersona({ employeeId: 'ROSTER-CB71F558', rosterOnly: true })).toBe(false); // Moaz
  });
  it('treats a null/absent rosterOnly as not-roster', () => {
    expect(isMockPersona({ employeeId: 'VSA-003', rosterOnly: null })).toBe(true);
    expect(isMockPersona({ employeeId: 'VSA-004' })).toBe(true);
  });
});
