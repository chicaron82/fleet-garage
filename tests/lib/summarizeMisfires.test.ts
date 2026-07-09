import { describe, it, expect } from 'vitest';
import { summarizeMisfires } from '../../src/lib/summarizeMisfires';

describe('summarizeMisfires', () => {
  it('splits read misfires from non-misread rejects, each counted', () => {
    const s = summarizeMisfires(['wrong_class_code', 'wrong_class_code', 'duplicate', 'wrong_plate']);
    expect(s.misfires).toEqual([
      { id: 'wrong_class_code', label: 'Wrong class code', count: 2, tunes: 'class codex' },
      { id: 'wrong_plate', label: 'Wrong plate', count: 1, tunes: 'plate prefix' },
    ]);
    expect(s.other).toEqual([{ id: 'duplicate', label: 'Duplicate', count: 1 }]);
    expect(s.misfireTotal).toBe(3);
  });

  it('orders each group by count, ties fall back to canonical reason order', () => {
    // class_code and details tie at 1 → class_code first (its order in REJECT_REASONS).
    const s = summarizeMisfires(['wrong_details', 'wrong_class_code']);
    expect(s.misfires.map(m => m.id)).toEqual(['wrong_class_code', 'wrong_details']);
  });

  it('ignores unknown/legacy reason ids', () => {
    const s = summarizeMisfires(['wrong_plate', 'legacy_thing', 'totally_unknown']);
    expect(s.misfires).toEqual([{ id: 'wrong_plate', label: 'Wrong plate', count: 1, tunes: 'plate prefix' }]);
    expect(s.misfireTotal).toBe(1);
  });

  it('empty in → empty out', () => {
    expect(summarizeMisfires([])).toEqual({ misfires: [], other: [], misfireTotal: 0 });
  });
});
