import { describe, it, expect } from 'vitest';
import { asRotation, nextRotation, rotationLabel } from '../../src/lib/keytagPhotoRotation';

// Aaron, 2026-08-30: *"some are shown on its side is there a way to rotate them here in the audit"*.
// The angle is DISPLAY METADATA — the stored file is never re-encoded, because a JPEG round-trip
// costs exactly the detail that makes a VIN readable off a tag.

describe('asRotation', () => {
  it('passes the four legal turns through', () => {
    for (const t of [0, 90, 180, 270]) expect(asRotation(t)).toBe(t);
  });

  // ⚠️ The column is constrained to four values, but a stale client or a hand-written row could
  // still hand us anything. A bad angle must degrade to "as captured", never to a tilted render.
  it('⚠️ normalises anything else rather than rendering a crooked photo', () => {
    expect(asRotation(null)).toBe(0);
    expect(asRotation(undefined)).toBe(0);
    expect(asRotation(360)).toBe(0);
    expect(asRotation(450)).toBe(90);
    expect(asRotation(-90)).toBe(270);
    expect(asRotation(47)).toBe(90);      // snaps to the nearest quarter
  });
});

describe('nextRotation', () => {
  // ⭐ FOUR TAPS RETURN IT EXACTLY AS CAPTURED. A rotate control with no way back is a control that
  // makes a mistake permanent — the opposite of why the file is left untouched.
  it('⭐ wraps, so four taps are a no-op', () => {
    let r = 0 as number;
    for (let i = 0; i < 4; i++) r = nextRotation(r);
    expect(r).toBe(0);
  });

  it('goes clockwise', () => {
    expect(nextRotation(0)).toBe(90);
    expect(nextRotation(90)).toBe(180);
    expect(nextRotation(270)).toBe(0);
  });

  it('recovers from a junk stored value', () => {
    expect(nextRotation(null)).toBe(90);
    expect(nextRotation(47)).toBe(180);
  });
});

// ⚠️ `rotationStyle` was tested here and is deleted (2026-08-30). Its unit tests all PASSED while
// both of Aaron's rotation bugs were live, because they asserted the object it returned rather than
// what that object did once a caller spread it next to its own width. The behaviour now lives in
// `tests/components/KeytagPhoto.test.tsx`, against the rendered box.


describe('rotationLabel', () => {
  it('is silent when there is nothing to explain', () => {
    expect(rotationLabel(0)).toBe('');
    expect(rotationLabel(null)).toBe('');
  });

  it('says the angle when there is one', () => {
    expect(rotationLabel(90)).toBe('rotated 90°');
  });
});
