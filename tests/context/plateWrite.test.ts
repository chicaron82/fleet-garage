import { describe, it, expect, vi, beforeEach } from 'vitest';

// ⭐⭐ ADOPTING A RE-PLATE MAKES THE STORED PHOTO OUT OF DATE, and this is the moment we know it.
// The offer only fires when the TAG is newer than the record, so the photo already on file was shot
// on the OLD plate — and `keytagPhotoWrite` is attach-if-missing, so this very scan will not replace
// it. Aaron's Suburban carried an Alberta-plate photo for five days, through a full audit that
// verified all four surviving fields, and nothing anywhere said the plate line was wrong.
// Aaron, 2026-08-31: *"i'd say just flag it for a retake the next time it comes in."*

let patch: Record<string, unknown> = {};
let rows: { id: string }[] = [{ id: 'v-1' }];

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      update: (p: Record<string, unknown>) => {
        patch = p;
        const chain = { eq: () => chain, select: () => Promise.resolve({ data: rows, error: null }) };
        return chain;
      },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeAdoptPlate } from '../../src/context/plateWrite';
import type { Vehicle } from '../../src/types';

function harness(over: Partial<Vehicle>) {
  const vehicle = {
    id: 'v-1', unitNumber: '5769880', licensePlate: '0GK641', make: 'Chevrolet',
    model: 'Suburban', year: 2026, color: 'Black', status: 'CLEAR', branchId: 'YWG',
    isTesla: false, hasMobileCable: null, hasJ1772Adapter: null, ...over,
  } as Vehicle;
  const adopt = makeAdoptPlate({ setAllVehicles: vi.fn(), currentVehicle: () => vehicle });
  return { adopt: (next: string) => adopt('v-1', next) };
}

beforeEach(() => { patch = {}; rows = [{ id: 'v-1' }]; });

describe('adoptPlate — the stored photo goes stale', () => {
  it('⭐ flags the tag photo stale and clears the audit stamp', async () => {
    const { adopt } = harness({
      keytagPhotoUrl: 'https://cdn/kt.jpg',
      keytagAuditResult: 'verified', keytagAuditedAt: '2026-08-29T06:40:29Z',
    });
    expect(await adopt('MCM560')).toBe(true);
    expect(patch).toMatchObject({
      license_plate: 'MCM560', keytag_audit_result: 'stale', keytag_audited_at: null,
    });
  });

  // ⚠️ 'stale', NEVER 'unreadable'. That tag is perfectly legible — the errand is a photo of a
  // DIFFERENT tag, not a better photo of the same one. Telling him he could not read it sends him
  // hunting for a blur that is not there.
  it('⚠️ never marks it unreadable', async () => {
    const { adopt } = harness({ keytagPhotoUrl: 'https://cdn/kt.jpg' });
    await adopt('MCM560');
    expect(patch.keytag_audit_result).toBe('stale');
  });

  // ⚠️ A car with NO photo is about to receive this scan's, which shows the NEW plate. Flagging
  // that stale would be wrong the instant it landed.
  it('⚠️ leaves a car with no photo alone', async () => {
    const { adopt } = harness({ keytagPhotoUrl: null });
    expect(await adopt('MCM560')).toBe(true);
    expect(patch).toEqual({ license_plate: 'MCM560', field_sources: { licensePlate: 'manual' } });
  });

  // The plate itself is still stamped 'manual' — a human confirming a re-plate outranks a later
  // scan of an old tag still lying in the car.
  it('stamps the plate manual, as before', async () => {
    const { adopt } = harness({ keytagPhotoUrl: 'https://cdn/kt.jpg' });
    await adopt('MCM560');
    expect(patch.field_sources).toEqual({ licensePlate: 'manual' });
  });

  // ⚠️ THE EXISTING GUARD STILL RULES. A misread is not a re-plate and must never reach the write,
  // stale flag or otherwise — the cheap reader is ~87.5% on plates.
  it('⚠️ a misread writes nothing at all', async () => {
    const { adopt } = harness({ licensePlate: 'LUR426', keytagPhotoUrl: 'https://cdn/kt.jpg' });
    expect(await adopt('LUR425')).toBe(false);
    expect(patch).toEqual({});
  });

  // A failed write leaves no local state behind either.
  it('reports failure when the row did not move', async () => {
    rows = [];
    const { adopt } = harness({ keytagPhotoUrl: 'https://cdn/kt.jpg' });
    expect(await adopt('MCM560')).toBe(false);
  });
});
