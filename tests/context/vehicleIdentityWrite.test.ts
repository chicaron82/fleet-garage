// A hand edit locks ONLY what he filled (2026-10-17). It used to stamp make/model/year/colour 'manual' as one
// bundle, so a year or colour he left unknown was locked against the tag read that would have filled it.
import { describe, it, expect, vi, beforeEach } from 'vitest';

let written: Record<string, unknown> | null = null;
vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { field_sources: { owningArea: 'manual' } } }) }) }),
      update: (row: Record<string, unknown>) => { written = row; return { eq: async () => ({ error: null }) }; },
    }),
  },
  writeWithRefresh: (fn: () => unknown) => fn(),
}));
vi.mock('../../src/context/classPinWrite', () => ({ pinClassMapping: vi.fn(async () => ({ pinned: false })) }));

const { writeVehicleIdentity } = await import('../../src/context/vehicleIdentityWrite');
const sources = () => written!.field_sources as Record<string, string>;

beforeEach(() => { written = null; });

describe('writeVehicleIdentity — stamps', () => {
  it('⭐ LJF692: make, model, code and class known; year and colour not — only the known four lock', async () => {
    await writeVehicleIdentity('v', null, 'LJF692',
      { make: 'Volkswagen', model: 'Taos', year: 0, color: '', rentalClass: 'B5', classCode: 'CVTA' }, () => {});
    expect(sources()).toMatchObject({ make: 'manual', model: 'manual', rentalClass: 'manual', classCode: 'manual', owningArea: 'manual' });
    expect(sources()).not.toHaveProperty('year');
    expect(sources()).not.toHaveProperty('color');
  });

  it('the "Unknown" placeholder colour is not a confirmation either', async () => {
    await writeVehicleIdentity('v', null, 'SB183H',
      { make: 'Tesla', model: 'Model 3', year: 2022, color: 'Unknown', rentalClass: 'E8' }, () => {});
    expect(sources()).toMatchObject({ year: 'manual' });
    expect(sources()).not.toHaveProperty('color');
  });

  it('control: a full identity still locks all four', async () => {
    await writeVehicleIdentity('v', null, 'KGE609',
      { make: 'Dodge', model: 'Ram 1500', year: 2026, color: 'White', rentalClass: null }, () => {});
    expect(sources()).toMatchObject({ make: 'manual', model: 'manual', year: 'manual', color: 'manual' });
  });
});
