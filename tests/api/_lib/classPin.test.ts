import { describe, it, expect } from 'vitest';
import { resolveRentalClass } from '../../../api/_lib/classPin';

// ⭐⭐ THE LOOP. Every scan that read a class code AND a rental class upserted the mapping,
// last-write-wins. So Aaron's correction died to the next scan, forever: *"saves me from constantly
// changing it"* (2026-08-25). CRHX prints Q4 on the tag; the real class is E6, per the Hertz chart
// he photographed 2026-07-20 — a fact FG has carried in a CODE COMMENT since 2026-07-22 while this
// endpoint went on re-teaching Q4.

const pin = (cls: string) => ({ rental_class: cls, pinned_at: '2026-08-26T04:04:49Z' });
const learned = (cls: string) => ({ rental_class: cls, pinned_at: null });

describe('resolveRentalClass', () => {
  // ── the case he actually reported ──────────────────────────────────────────────────────────
  it('⭐⭐ a pin beats the tag, and the scan may NOT re-teach over it', () => {
    const d = resolveRentalClass(pin('E6'), 'Q4');
    expect(d.rentalClass).toBe('E6');
    expect(d.rentalClassPinned).toBe(true);
    expect(d.teach).toBe(false);          // ← without this, the next scan undoes him again
  });

  // ⚠️ SURFACE THE DISAGREEMENT, NEVER LEAN. The pin wins, but the tag is evidence, not noise:
  // hiding it is how a real Hertz reclassification would slip past unnoticed.
  it('keeps what the tag said, so the surface can show both', () => {
    expect(resolveRentalClass(pin('E6'), 'Q4').rentalClassOnTag).toBe('Q4');
  });

  it('says nothing about the tag when the two agree — no false disagreement', () => {
    const d = resolveRentalClass(pin('E6'), 'E6');
    expect(d.rentalClassOnTag).toBeUndefined();
    expect(d.rentalClassPinned).toBe(true);
    expect(d.teach).toBe(false);
  });

  it('a pin holds even when the tag class is unreadable', () => {
    const d = resolveRentalClass(pin('E6'), '');
    expect(d.rentalClass).toBe('E6');
    expect(d.rentalClassOnTag).toBeUndefined();
    expect(d.teach).toBe(false);
  });

  // ── everything UNPINNED must behave exactly as it did before ───────────────────────────────
  it('unpinned: the tag is still the chart, and still teaches', () => {
    const d = resolveRentalClass(learned('Q4'), 'B5');
    expect(d.rentalClass).toBe('B5');
    expect(d.teach).toBe(true);
    expect(d.rentalClassPinned).toBeUndefined();
  });

  it('unpinned with an unreadable tag: infer from what a prior clean scan taught', () => {
    const d = resolveRentalClass(learned('Q4'), null);
    expect(d).toMatchObject({ rentalClass: 'Q4', rentalClassInferred: true, teach: false });
  });

  it('a brand-new code with a legible tag teaches itself', () => {
    expect(resolveRentalClass(null, 'T6')).toEqual({ rentalClass: 'T6', teach: true });
  });

  // ⚠️ Nothing known and nothing legible must not teach — a caller trusting `teach` blindly could
  // otherwise write an empty class over a good row.
  it('knows nothing, says nothing, teaches nothing', () => {
    expect(resolveRentalClass(null, null)).toEqual({ teach: false });
    expect(resolveRentalClass(null, '   ')).toEqual({ teach: false });
    expect(resolveRentalClass({ rental_class: null, pinned_at: null }, undefined)).toEqual({ teach: false });
  });

  // ⚠️ A pin row with no class is not a pin — it must not silently blank the tag's answer.
  it('a pinned row carrying no class falls through to the tag', () => {
    const d = resolveRentalClass({ rental_class: '', pinned_at: '2026-08-26T04:04:49Z' }, 'Q4');
    expect(d.rentalClass).toBe('Q4');
    expect(d.rentalClassPinned).toBeUndefined();
  });

  it('normalises case and whitespace on both sides before comparing', () => {
    const d = resolveRentalClass({ rental_class: ' e6 ', pinned_at: 'x' }, ' q4 ');
    expect(d.rentalClass).toBe('E6');
    expect(d.rentalClassOnTag).toBe('Q4');
    // …and an only-cosmetic difference is not a disagreement.
    expect(resolveRentalClass({ rental_class: 'E6', pinned_at: 'x' }, ' e6 ').rentalClassOnTag).toBeUndefined();
  });
});
