import { describe, it, expect } from 'vitest';
import { HOLD_TYPE_LABELS, holdTypeLabel } from '../../src/lib/holdTypeLabels';

describe('HOLD_TYPE_LABELS', () => {
  it('labels every canonical hold type', () => {
    expect(HOLD_TYPE_LABELS).toEqual({
      damage: 'Damage',
      hail: 'Hail',
      detail: 'Detail',
      mechanical: 'Mechanical',
      sale_car: 'Sale Car',
      missing_accessories: 'Missing Accessories',
    });
  });
});

describe('holdTypeLabel', () => {
  it('returns the canonical label for a known type', () => {
    expect(holdTypeLabel('mechanical')).toBe('Mechanical');
    expect(holdTypeLabel('missing_accessories')).toBe('Missing Accessories');
  });

  it('title-cases an unknown raw string as a fallback', () => {
    expect(holdTypeLabel('recall')).toBe('Recall');
  });

  it('handles an empty string without throwing', () => {
    expect(holdTypeLabel('')).toBe('');
  });
});
