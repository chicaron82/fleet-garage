import { describe, it, expect } from 'vitest';
import { canEnterFleetBalance, isManagement, DEMO_WASHBAY_30DAY_AVG } from '../../src/lib/analytics';

describe('canEnterFleetBalance', () => {
  it('allows managers and Lead VSA', () => {
    expect(canEnterFleetBalance('Branch Manager')).toBe(true);
    expect(canEnterFleetBalance('Operations Manager')).toBe(true);
    expect(canEnterFleetBalance('Lead VSA')).toBe(true);
  });

  it('denies floor VSA and others', () => {
    expect(canEnterFleetBalance('VSA')).toBe(false);
    expect(canEnterFleetBalance('Driver')).toBe(false);
  });
});

describe('isManagement', () => {
  it('is true for the three manager roles', () => {
    expect(isManagement('Branch Manager')).toBe(true);
    expect(isManagement('Operations Manager')).toBe(true);
    expect(isManagement('City Manager')).toBe(true);
  });

  it('is false for Lead VSA (a lead is not management here)', () => {
    expect(isManagement('Lead VSA')).toBe(false);
    expect(isManagement('VSA')).toBe(false);
  });
});

describe('DEMO_WASHBAY_30DAY_AVG', () => {
  it('is the rounded mean of the demo history (one decimal)', () => {
    expect(DEMO_WASHBAY_30DAY_AVG).toBeCloseTo(8.3, 1);
    // rounded to a single decimal place
    expect(Math.round(DEMO_WASHBAY_30DAY_AVG * 10) / 10).toBe(DEMO_WASHBAY_30DAY_AVG);
  });
});
