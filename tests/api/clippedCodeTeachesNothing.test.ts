import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isTeachableClassCode } from '../../api/_lib/vehicleClassCodex';

// Aaron, 2026-10-01: *"Also where 'TXF' came from."* From FWC4510's tag, on 2026-09-08: the perforation
// cut the C off `CTXF`, the scan read `TXF` beside class B4, and the learner taught `TXF → B4`. It
// would have re-taught it on every scan of that tag, so the audit card's Forget could never stick.

describe('a clipped code teaches nothing', () => {
  it('⭐ a three-character code is not teachable', () => {
    expect(isTeachableClassCode('TXF')).toBe(false);
    expect(isTeachableClassCode('CTXF')).toBe(true);
    expect(isTeachableClassCode('Q4')).toBe(false);
    expect(isTeachableClassCode('CTM342')).toBe(false);
  });

  // ⚠️ The learner sits inside the handler that calls the model, where no unit test reaches it. This
  // pins the one line that matters: the class store is consulted and taught only behind that gate.
  it('⭐⭐ the scan-time learner is gated on it', () => {
    const src = readFileSync('api/_lib/keytagReader.ts', 'utf8');
    const learner = src.slice(src.indexOf('Rental-class LEARN + INFER'), src.indexOf('return read;', src.indexOf('Rental-class LEARN + INFER')));
    expect(learner).toContain("from('class_code_rental_class').upsert(");
    expect(learner).toMatch(/if \(read\.classCode && isTeachableClassCode\(read\.classCode\)\) \{/);
    expect(learner).not.toMatch(/if \(read\.classCode && !isAmbiguousClassCode/);
  });
});
