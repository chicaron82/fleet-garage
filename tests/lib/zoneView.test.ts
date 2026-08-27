import { describe, it, expect } from 'vitest';
import { initialZoneView, initialThirdRow, countOnView, isInteriorZone } from '../../src/lib/zoneView';

describe('isInteriorZone', () => {
  it('separates the two maps', () => {
    expect(isInteriorZone('cargo-area')).toBe(true);
    expect(isInteriorZone('trunk-liftgate')).toBe(false);   // the LID — exterior
    expect(isInteriorZone('hood')).toBe(false);
  });
});

describe('initialZoneView', () => {
  // ⭐⭐⭐ THE DEFECT THIS PREVENTS. A hold tagged only "missing rear headrest" opening on the
  // exterior map shows an empty car — which reads as "no zones recorded" and re-creates the
  // recorded-but-not-knowable bug inside the feature built to fix it.
  it('opens on the cabin when every tag is interior', () => {
    expect(initialZoneView(['seat-second-passenger'])).toBe('interior');
    expect(initialZoneView(['cargo-area', 'head-unit'])).toBe('interior');
  });

  it('opens on the exterior for a mixed hold — the common case, interior one tap away', () => {
    expect(initialZoneView(['hood', 'seat-second-passenger'])).toBe('exterior');
  });

  it('opens on the exterior for an untagged hold', () => {
    expect(initialZoneView([])).toBe('exterior');
  });

  it('opens on the exterior for a purely exterior hold', () => {
    expect(initialZoneView(['front-bumper', 'hood'])).toBe('exterior');
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
