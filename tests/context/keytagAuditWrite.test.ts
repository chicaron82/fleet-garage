import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vehicle } from '../../src/types';

// The auditor's write path — a HUMAN read the stored key-tag photo.
//
// ⭐ The two behaviours that separate this from every other tag write, and the reason it is its own
// module: confirming an unchanged field is still a WRITE (it stamps 'manual', which locks the field
// against later misreads), and a VIN may be CORRECTED here — the one place that is allowed, because
// `vinWrite`'s immutability exists to stop a MODEL rewriting a good value with nobody present.

const updates: Record<string, unknown>[] = [];
let existingSources: Record<string, string> = {};
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { field_sources: existingSources } }) }) }),
      update: (payload: Record<string, unknown>) => { updates.push(payload); return { eq: async () => ({ error: null }) }; },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeSaveKeytagAudit, makeFlagKeytagUnreadable, makeReopenKeytagAudit } from '../../src/context/keytagAuditWrite';

const car = (over: Partial<Vehicle> & { id: string }): Vehicle => ({
  unitNumber: '5420427', licensePlate: 'LUR202', make: 'Toyota', model: 'RAV4', year: 2026,
  color: 'White', status: 'CLEAR', branchId: 'YWG',
  owningArea: '8199', rentalClass: 'Q4', classCode: 'CCVL', vinLast9: 'ABC123456',
  ...over,
} as Vehicle);

const setAll = vi.fn();
const save = (fleet: Vehicle[]) => makeSaveKeytagAudit({ setAllVehicles: setAll, allVehicles: fleet, userId: 'aaron' });

const FULL = {
  owningArea: '8199', rentalClass: 'Q4', classCode: 'CCVL', unitNumber: '5420427', vinLast9: 'ABC123456',
};

beforeEach(() => { updates.length = 0; existingSources = {}; setAll.mockClear(); });

describe('saveKeytagAudit — confirming is a write', () => {
  it('⭐ stamps every confirmed field manual even when nothing changed', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0].field_sources).toEqual({
      owningArea: 'manual', rentalClass: 'manual', classCode: 'manual',
      unitNumber: 'manual', vinLast9: 'manual',
    });
  });

  it('writes no column for a field he only confirmed', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0]).not.toHaveProperty('owning_area');
    expect(updates[0]).not.toHaveProperty('class_code');
  });

  it('always records who audited it and when', async () => {
    await save([car({ id: 'me' })])('me', FULL);
    expect(updates[0]).toMatchObject({ keytag_audited_by: 'aaron', keytag_audit_result: 'verified' });
    expect(typeof updates[0].keytag_audited_at).toBe('string');
  });

  it('merges the manual stamps onto provenance the record already had', async () => {
    existingSources = { color: 'tag' };
    await save([car({ id: 'me' })])('me', { owningArea: '8199' });
    expect(updates[0].field_sources).toEqual({ color: 'tag', owningArea: 'manual' });
  });
});

describe('saveKeytagAudit — filling and correcting', () => {
  it('fills a blank field and stamps it', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '8199' });
    expect(updates[0]).toMatchObject({ owning_area: '8199' });
    expect((updates[0].field_sources as Record<string, string>).owningArea).toBe('manual');
  });

  it('⭐ CORRECTS a VIN that is already on file — the one write allowed to', async () => {
    // vinWrite refuses this by design: first good read wins, because a MODEL might be misreading.
    // Aaron with the tag in front of him is the other case entirely.
    await save([car({ id: 'me', vinLast9: 'WRONG9999' })])('me', { ...FULL, vinLast9: 'ABC123456' });
    expect(updates[0]).toMatchObject({ vin_last9: 'ABC123456' });
    expect((updates[0].field_sources as Record<string, string>).vinLast9).toBe('manual');
  });

  it('⚠️ leaves a field he could not read alone — neither written nor stamped', async () => {
    // A blank means "I couldn't see it either", which is not a fact about the car.
    await save([car({ id: 'me', vinLast9: null })])('me', { ...FULL, vinLast9: '   ' });
    expect(updates[0]).not.toHaveProperty('vin_last9');
    expect(updates[0].field_sources).not.toHaveProperty('vinLast9');
  });

  it('trims what he typed before comparing, so trailing space is not a change', async () => {
    await save([car({ id: 'me' })])('me', { ...FULL, classCode: '  CCVL  ' });
    expect(updates[0]).not.toHaveProperty('class_code');
    expect((updates[0].field_sources as Record<string, string>).classCode).toBe('manual');
  });
});

describe('saveKeytagAudit — the unit# collision guard', () => {
  const OTHER = car({ id: 'other', licensePlate: 'LUR234', unitNumber: '5422027' });

  it('⭐ refuses a unit number another live record already carries', async () => {
    const res = await save([OTHER, car({ id: 'me' })])('me', { ...FULL, unitNumber: '5422027' });
    expect(res.unitConflict?.licensePlate).toBe('LUR234');
    expect(updates[0]).not.toHaveProperty('unit_number');
    expect(updates[0].field_sources).not.toHaveProperty('unitNumber');
  });

  it('⭐ still writes everything else he read', async () => {
    const res = await save([OTHER, car({ id: 'me', owningArea: null })])('me', {
      ...FULL, unitNumber: '5422027', owningArea: '8199',
    });
    expect(res.unitConflict).toBeTruthy();
    expect(updates[0]).toMatchObject({ owning_area: '8199' });
  });

  it('does not trip on a unit number the record already has', async () => {
    // The guard exists for a CHANGE. Firing it on an unchanged value would block the audit of any
    // car that is already half of a pre-existing duplicate.
    const twin = car({ id: 'other', licensePlate: 'LUR234', unitNumber: '5420427' });
    const res = await save([twin, car({ id: 'me' })])('me', FULL);
    expect(res.unitConflict).toBeUndefined();
    expect((updates[0].field_sources as Record<string, string>).unitNumber).toBe('manual');
  });

  it('throws rather than guessing when the vehicle is not in the fleet', async () => {
    await expect(save([])('ghost', FULL)).rejects.toThrow('Vehicle not found');
  });
});

describe('flagKeytagUnreadable', () => {
  it('⭐ stamps the car unreadable — this IS the retake watchlist', async () => {
    const flag = makeFlagKeytagUnreadable({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me');
    expect(updates[0]).toMatchObject({ keytag_audit_result: 'unreadable', keytag_audited_by: 'aaron' });
  });

  it('⚠️ writes no identity field — he did not read them', async () => {
    const flag = makeFlagKeytagUnreadable({ setAllVehicles: setAll, userId: 'aaron' });
    await flag('me');
    for (const col of ['owning_area', 'rental_class', 'class_code', 'unit_number', 'vin_last9', 'field_sources']) {
      expect(updates[0], `unreadable must not write ${col}`).not.toHaveProperty(col);
    }
  });
});

describe('reopenKeytagAudit — the auditor\'s undo', () => {
  // ⭐ WHY IT EXISTS: an audited car leaves the queue permanently, so the first wrong entry could
  // only be corrected with hand-written SQL. A surface that writes at the TOP of the provenance
  // ladder needs a way back, or every one of its mistakes is permanent.
  const reopen = () => makeReopenKeytagAudit({ setAllVehicles: setAll });

  it('clears the audit stamp so the car re-enters the queue', async () => {
    await reopen()('me');
    expect(updates[0]).toEqual({ keytag_audited_at: null, keytag_audited_by: null, keytag_audit_result: null });
  });

  it('⚠️ leaves the manual locks alone — reopening is not un-confirming', async () => {
    // Dropping them would let the next scan overwrite good values in the window before he gets
    // back to the car.
    await reopen()('me');
    expect(updates[0]).not.toHaveProperty('field_sources');
  });

  it('clears an unreadable flag too — a car off the retake list goes back in line', async () => {
    await reopen()('me');
    expect(updates[0].keytag_audit_result).toBeNull();
  });
});

describe('saveKeytagAudit — the owning area is normalised on the way in', () => {
  // Aaron: "the leading zero i usually would drop anyway, as some older owning ones have 08890,
  // 08999, 08898. that handwritten seltos has 08197 but its still just 8197 so 4."
  //
  // ⚠️ `normalizeOwning` has always known this, and until now NO WRITER CALLED IT — it was wired
  // into the scan read alone, so a hand-typed owning went to the database exactly as printed. That
  // is how SPHV03 came to hold `02294` for a branch that is 2294.
  it('⭐ drops a printed leading zero — 08191 IS 8191', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '08191' });
    expect(updates[0]).toMatchObject({ owning_area: '8191' });
  });

  it('treats a printed 08199 as a CONFIRMATION of a stored 8199, not a change', async () => {
    await save([car({ id: 'me', owningArea: '8199' })])('me', { ...FULL, owningArea: '08199' });
    expect(updates[0]).not.toHaveProperty('owning_area');
    expect((updates[0].field_sources as Record<string, string>).owningArea).toBe('manual');
  });

  it('⭐ keeps a genuine five-digit branch that does not start with a zero', async () => {
    // His own caveat: overseas numbering may legitimately run to five digits. Only LEADING zeros
    // are stripped, so such a number survives intact.
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '12294' });
    expect(updates[0]).toMatchObject({ owning_area: '12294' });
  });

  it('refuses a stub too short to be a branch rather than storing a fragment', async () => {
    await save([car({ id: 'me', owningArea: null })])('me', { ...FULL, owningArea: '081' });
    expect(updates[0]).not.toHaveProperty('owning_area');
  });
});
