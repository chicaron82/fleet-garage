import { describe, it, expect, vi } from 'vitest';

// ⭐ ENFORCEMENT, NOT DOCUMENTATION (audit 2026-09-20). `REREAD_NEVER_WRITES` named a rule nothing
// checked — its own comment admitted the key count was safe "by ACCIDENT of the type rather than by
// decision, and a future field added to `KeytagField` would inherit this job silently". This test
// forces exactly that future: a resolver that DOES offer a keyCount fill.
vi.mock('../../src/lib/resolveKeytag', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  resolveKeytag: () => ({
    kind: 'partial',
    fills: [{ field: 'keyCount', value: 2 }, { field: 'vinLast9', value: '3S7792108' }],
    changes: [], conflicts: [],
  }),
}));

import { planKeytagReread } from '../../src/lib/planKeytagReread';
import type { KeytagRead } from '../../api/_lib/keytagRead';
import type { Vehicle } from '../../src/types';

const v = {
  id: 'v-1', unitNumber: '5423827', licensePlate: 'LUR554', make: 'Kia', model: 'Seltos',
  year: 2025, color: 'Gray', status: 'CLEAR', branchId: 'YWG', isTesla: false,
  hasMobileCable: null, hasJ1772Adapter: null,
} as unknown as Vehicle;

describe('planKeytagReread — the key count is his to make', () => {
  it('⚠️⚠️ drops a keyCount fill even when the resolver offers one', () => {
    const p = planKeytagReread({ plate: 'LUR554' } as KeytagRead, v);
    expect(p.fills.map(f => f.field)).toEqual(['vinLast9']);
  });
});
