import { describe, it, expect } from 'vitest';
import { REJECT_REASONS, rejectReason, rejectReasonLabel } from '../../src/lib/rejectReasons';

describe('rejectReasons', () => {
  it('marks read-error reasons as misfires and the rest as not', () => {
    const misfires = REJECT_REASONS.filter(r => r.misfire).map(r => r.id);
    const notMisfires = REJECT_REASONS.filter(r => !r.misfire).map(r => r.id);
    expect(misfires).toEqual(['wrong_class_code', 'wrong_plate', 'wrong_details']);
    expect(notMisfires).toEqual(['duplicate', 'not_needed']);
  });

  it('every misfire names a tuning lever; non-misfires name none', () => {
    for (const r of REJECT_REASONS) {
      if (r.misfire) expect(r.tunes.length).toBeGreaterThan(0);
      else expect(r.tunes).toBe('');
    }
  });

  it('rejectReason looks up by id, undefined for unknown/blank', () => {
    expect(rejectReason('wrong_plate')?.label).toBe('Wrong plate');
    expect(rejectReason('nope')).toBeUndefined();
    expect(rejectReason(null)).toBeUndefined();
    expect(rejectReason(undefined)).toBeUndefined();
  });

  it('rejectReasonLabel resolves a known id, falls back to the raw value, blank for none', () => {
    expect(rejectReasonLabel('duplicate')).toBe('Duplicate');
    expect(rejectReasonLabel('legacy_value')).toBe('legacy_value'); // honest fallback, never blank
    expect(rejectReasonLabel(null)).toBe('');
    expect(rejectReasonLabel(undefined)).toBe('');
  });
});
