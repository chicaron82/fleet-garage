import { describe, it, expect } from 'vitest';
import { validatePromotionInput } from '../../src/lib/rosterPromotion';

describe('validatePromotionInput', () => {
  it('accepts a real employee id and trims it', () => {
    const r = validatePromotionInput({ rosterId: 'abc', employeeId: '  300210 ' });
    expect(r).toEqual({ ok: true, employeeId: '300210' });
  });

  it('rejects an empty employee id', () => {
    const r = validatePromotionInput({ rosterId: 'abc', employeeId: '   ' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/employee ID/i);
  });

  it('rejects the ROSTER- placeholder id (the ghost is the source, not the target)', () => {
    const r = validatePromotionInput({ rosterId: 'abc', employeeId: 'ROSTER-E262CCF8' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/real employee ID/i);
  });

  it('rejects a missing roster selection', () => {
    const r = validatePromotionInput({ rosterId: '', employeeId: '300210' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/selected/i);
  });
});
