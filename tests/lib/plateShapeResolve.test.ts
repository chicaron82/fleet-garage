// Resolving a misread plate from the owning area on the same key tag.
//
// ⚠️ Every fixture here is a REAL row off Aaron's 2026-09-05 pump card — the ones I failed on and he
// corrected in one line. A synthetic case would prove the code runs; these prove it would have saved
// the reads that actually cost him messages.
import { describe, it, expect } from 'vitest';
import { suggestPlateByShape, shapeCandidates } from '../../src/lib/plateShapeResolve';

// The live fleet, trimmed to what these cases need.
const FLEET = [
  { licensePlate: '0HH120' },   // Calgary (8193) — I read OHH120
  { licensePlate: '0GZ564' },   // Calgary       — I read OGZ564
  { licensePlate: 'LUR316' },   // Winnipeg
  { licensePlate: 'DFKJ947' },  // Toronto (8197)
  { licensePlate: 'XT630N' },   // BC (8191)
];

describe('suggestPlateByShape — the owning area on the tag resolves the read', () => {
  it("⭐ OHH120 + Calgary → 0HH120, the case Aaron fixed in one line", () => {
    expect(suggestPlateByShape('OHH120', '8193', FLEET))
      .toMatchObject({ plate: '0HH120', from: 'OHH120', shape: '9AA999' });
  });

  it('⭐ OGZ564 + Calgary → 0GZ564 — same class of error, same rescue', () => {
    expect(suggestPlateByShape('OGZ564', '8193', FLEET)?.plate).toBe('0GZ564');
  });

  it('⚠️ says NOTHING when the plate already resolves — a hit is not second-guessed', () => {
    // Silent even though LUR316 is the wrong shape for Calgary: FG found the car.
    expect(suggestPlateByShape('LUR316', '8193', FLEET)).toBeNull();
  });

  it('⚠️ says nothing when the correction resolves to no car — a guess is not a suggestion', () => {
    // 0AA111 is Calgary-shaped and simply is not in the fleet.
    expect(suggestPlateByShape('OAA111', '8193', FLEET)).toBeNull();
  });

  it('⚠️ says nothing for a branch that cannot vouch for a shape (8890, mixed re-plates)', () => {
    expect(suggestPlateByShape('OHH120', '8890', FLEET)).toBeNull();
  });

  it('⚠️ says nothing when the shape already agrees — no correction is owed', () => {
    expect(suggestPlateByShape('0AB999', '8193', FLEET)).toBeNull();
  });

  it('⚠️ a different LENGTH is a different format, not a misread', () => {
    expect(suggestPlateByShape('OHH1200', '8193', FLEET)).toBeNull();
  });

  it('⭐ handles the DIGIT→LETTER direction too (5 read where an S belongs)', () => {
    // Toronto is AAAA999; BFK5947 reads AAA9999, so position 3 wants a letter.
    expect(shapeCandidates('BFK5947', 'AAAA999')).toContain('BFKS947');
  });

  it('⚠️⚠️ and it stays silent on that one, because BFKS947 is not the car — DFKJ947 is', () => {
    // The honest limit: a `B`→`D` misread is not a shape error and this cannot see it. Correctly
    // silent rather than confidently wrong.
    expect(suggestPlateByShape('BFK5947', '8197', FLEET)).toBeNull();
  });
});

describe('shapeCandidates', () => {
  it('only rewrites positions where the shape actually disagrees', () => {
    // 9AA999 vs OHH120 (AAA999): position 0 alone is wrong.
    expect(shapeCandidates('OHH120', '9AA999')).toEqual(['0HH120']);
  });

  it('returns nothing when the lengths differ', () => {
    expect(shapeCandidates('OHH12', '9AA999')).toEqual([]);
  });
});
