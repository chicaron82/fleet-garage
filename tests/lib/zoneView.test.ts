import { describe, it, expect } from 'vitest';
import { initialThirdRow, countOnView, isInteriorZone } from '../../src/lib/zoneView';

describe('isInteriorZone', () => {
  it('separates the two maps', () => {
    expect(isInteriorZone('cargo-area')).toBe(true);
    expect(isInteriorZone('trunk-liftgate')).toBe(false);   // the LID — exterior
    expect(isInteriorZone('hood')).toBe(false);
  });
});

describe('initialThirdRow', () => {
  it('is on when the bench is already tagged, so the tag is never hidden', () => {
    expect(initialThirdRow(['seat-third-bench'])).toBe(true);
    expect(initialThirdRow(['seat-second-centre'])).toBe(false);
  });
});

describe('countOnView', () => {
  it('counts what sits on each map', () => {
    const mixed = ['hood', 'front-bumper', 'cargo-area'];
    expect(countOnView(mixed, 'exterior')).toBe(2);
    expect(countOnView(mixed, 'interior')).toBe(1);
  });

  it('is zero on an empty set', () => {
    expect(countOnView([], 'interior')).toBe(0);
  });
});
