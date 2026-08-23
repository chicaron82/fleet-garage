import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Vehicle } from '../../src/types';

// ⭐⭐ THE GUARD THIS FILE EXISTS FOR. A unit number is fleet-wide, and the registration form has
// always refused to staple one onto two records (useUnitConflict → findUnitConflict). A SCAN writing
// the same field had no such check — and that is what produced BOTH duplicate-unit findings this
// week: LUR254 on 2026-08-21 and LUR243 tonight. Each time a tag wrote a unit straight over the top
// and the collision surfaced days later on the audit board instead of at the car.

const updates: Record<string, unknown>[] = [];
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { field_sources: {} } }) }) }),
      update: (payload: Record<string, unknown>) => { updates.push(payload); return { eq: async () => ({ error: null }) }; },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));

import { makeUpdateVehicleFields } from '../../src/context/vehicleFieldsWrite';

const car = (over: Partial<Vehicle> & { id: string }): Vehicle => ({
  unitNumber: null, licensePlate: 'LUR254', make: 'Nissan', model: 'Versa', year: 2025,
  color: 'White', status: 'CLEAR', branchId: 'YWG', ...over,
} as Vehicle);

const OTHER = car({ id: 'other', licensePlate: 'LUR234', unitNumber: '5422027' });
const setAll = vi.fn();
const make = (fleet: Vehicle[]) => makeUpdateVehicleFields({ setAllVehicles: setAll, allVehicles: fleet });

beforeEach(() => { updates.length = 0; setAll.mockClear(); });

describe('updateVehicleFields — the unit# collision guard', () => {
  it('⭐ does NOT write a unit number another live record already carries', async () => {
    const write = make([OTHER, car({ id: 'me' })]);
    const res = await write('me', [{ field: 'unitNumber', value: '5422027' } as never]);
    expect(res.unitConflict?.licensePlate).toBe('LUR234');
    expect(updates).toHaveLength(0);   // nothing else to write, so nothing was written
  });

  it('⭐ still writes everything ELSE the tag read', async () => {
    // Refusing the whole batch would throw away good data to avoid one bad field.
    const write = make([OTHER, car({ id: 'me' })]);
    const res = await write('me', [
      { field: 'unitNumber', value: '5422027' },
      { field: 'color', value: 'Blue' },
    ] as never);
    expect(res.unitConflict?.licensePlate).toBe('LUR234');
    expect(updates[0]).toMatchObject({ color: 'Blue' });
    expect(updates[0]).not.toHaveProperty('unit_number');
  });

  it('writes the unit number when nothing else holds it', async () => {
    const write = make([car({ id: 'me' })]);
    const res = await write('me', [{ field: 'unitNumber', value: '5422027' }] as never);
    expect(res.unitConflict).toBeUndefined();
    expect(updates[0]).toMatchObject({ unit_number: '5422027' });
  });

  it('never conflicts a record with itself', async () => {
    const me = car({ id: 'me', unitNumber: '5422027' });
    const res = await make([me])('me', [{ field: 'unitNumber', value: '5422027' }] as never);
    expect(res.unitConflict).toBeUndefined();
  });

  it('ignores an archived record — a retired car is not a live collision', async () => {
    const gone = car({ id: 'gone', unitNumber: '5422027', archivedAt: '2026-01-01' } as never);
    const res = await make([gone, car({ id: 'me' })])('me', [{ field: 'unitNumber', value: '5422027' }] as never);
    expect(res.unitConflict).toBeUndefined();
    expect(updates[0]).toMatchObject({ unit_number: '5422027' });
  });

  it('⭐ does not pick a winner — it reports and leaves both records alone', async () => {
    // LUR254's tag was right and the other row was bogus; LUR243's was the opposite. The data
    // cannot tell them apart, and he is holding the one thing that can.
    const write = make([OTHER, car({ id: 'me' })]);
    const res = await write('me', [{ field: 'unitNumber', value: '5422027' }] as never);
    expect(res.unitConflict).toBe(OTHER);
    expect(setAll).not.toHaveBeenCalled();
  });
});
