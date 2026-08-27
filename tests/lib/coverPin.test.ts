import { describe, it, expect } from 'vitest';
import { effectivePinnedIndex, coverPhotoUrlFor } from '../../src/lib/coverPin';

describe('effectivePinnedIndex', () => {
  // ⭐ The reported bug: one photo, no tap, nothing pinned. Three live holds were in this state.
  it('pins the only photo when there is exactly one', () => {
    expect(effectivePinnedIndex(null, 1)).toBe(0);
  });

  // ⭐ WIDENED 2026-08-27 by Aaron: *"just marking the first photo if there are multiple. I can
  // always change it later too."* A wrong cover costs one tap; NO cover leaves the row looking like
  // a hold with no photos at all. Something beats nothing, and the first photo is the one he chose
  // to take first. It also makes this agree with Effie's path, which always did it this way.
  it('pins the FIRST photo when there are several, as a changeable default', () => {
    expect(effectivePinnedIndex(null, 2)).toBe(0);
    expect(effectivePinnedIndex(null, 5)).toBe(0);
  });

  it('pins nothing when there are no photos', () => {
    expect(effectivePinnedIndex(null, 0)).toBeNull();
  });

  it('an explicit tap always wins, at any count', () => {
    expect(effectivePinnedIndex(1, 3)).toBe(1);
    expect(effectivePinnedIndex(0, 1)).toBe(0);
    expect(effectivePinnedIndex(2, 2)).toBe(2);   // out of range is caught downstream, not here
  });
});

describe('coverPhotoUrlFor', () => {
  it('returns the only photo when there is one and nothing was tapped', () => {
    expect(coverPhotoUrlFor(null, ['a'], ['url-a'])).toBe('url-a');
  });

  it('returns the tapped photo when there are several', () => {
    expect(coverPhotoUrlFor(1, ['a', 'b', 'c'], ['ua', 'ub', 'uc'])).toBe('ub');
  });

  it('falls back to the first photo when several and no tap', () => {
    expect(coverPhotoUrlFor(null, ['a', 'b'], ['ua', 'ub'])).toBe('ua');
  });

  // ⚠️⚠️ THE SAFETY PROPERTY THE ORIGINAL CODE HAD, PRESERVED. A failed upload is filtered out of the
  // URL list, so every index after it shifts — pinning by a stale index would put a DIFFERENT car's
  // damage on this card. Refuse rather than guess.
  it('refuses when an upload dropped and the indices no longer line up', () => {
    expect(coverPhotoUrlFor(1, ['a', 'b', 'c'], ['ua', 'uc'])).toBeNull();
    // …including the single-photo auto-pin, which must not skip the check.
    expect(coverPhotoUrlFor(null, ['a'], [])).toBeNull();
  });

  it('refuses an out-of-range tap rather than reaching past the end', () => {
    expect(coverPhotoUrlFor(5, ['a', 'b'], ['ua', 'ub'])).toBeNull();
    expect(coverPhotoUrlFor(-1, ['a', 'b'], ['ua', 'ub'])).toBeNull();
  });

  it('returns nothing for a hold with no photos at all', () => {
    expect(coverPhotoUrlFor(null, [], [])).toBeNull();
  });
});
