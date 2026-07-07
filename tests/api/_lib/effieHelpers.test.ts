import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { normalizePlate, resolveVehicleRow, toVehicleFact, type VehicleRow } from '../../../api/_lib/effieHelpers.js';

function row(overrides: Partial<VehicleRow> = {}): VehicleRow {
  return {
    id: 'v1',
    license_plate: 'LUR187',
    unit_number: '5501',
    make: 'Toyota',
    model: 'Corolla',
    year: 2023,
    color: 'Silver',
    ...overrides,
  };
}

/** Mocks the one query resolveVehicleRow issues: .from('vehicles').select(...).is('archived_at', null). */
function fakeSupabase(data: VehicleRow[] | null, error: unknown = null): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        is: () => Promise.resolve({ data, error }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('normalizePlate', () => {
  it('trims, uppercases, and strips internal whitespace', () => {
    expect(normalizePlate(' lur 187 ')).toBe('LUR187');
  });
});

describe('resolveVehicleRow', () => {
  it('returns null for an empty plate without querying', async () => {
    expect(await resolveVehicleRow(fakeSupabase([row()]), '   ')).toBeNull();
  });

  it('matches on exact (normalized) plate', async () => {
    const fleet = [row({ license_plate: 'LUR187' })];
    const match = await resolveVehicleRow(fakeSupabase(fleet), 'lur187');
    expect(match?.license_plate).toBe('LUR187');
  });

  it('matches on unit number when the plate misses', async () => {
    const fleet = [row({ license_plate: 'LUR187', unit_number: '5501' })];
    const match = await resolveVehicleRow(fakeSupabase(fleet), '5501');
    expect(match?.unit_number).toBe('5501');
  });

  it('falls back to the MB-prefix-corrected plate when the raw read is a known misread', async () => {
    // KMR is a one-char misread of KUR (a real MB prefix); fleet has the corrected KUR250.
    const fleet = [row({ license_plate: 'KUR250', unit_number: null })];
    const match = await resolveVehicleRow(fakeSupabase(fleet), 'KMR250');
    expect(match?.license_plate).toBe('KUR250');
  });

  it('returns null when nothing in the fleet matches', async () => {
    const fleet = [row({ license_plate: 'LUR187', unit_number: '5501' })];
    expect(await resolveVehicleRow(fakeSupabase(fleet), 'ZZZ999')).toBeNull();
  });

  it('throws when the query errors', async () => {
    await expect(resolveVehicleRow(fakeSupabase(null, new Error('boom')), 'LUR187')).rejects.toThrow('boom');
  });
});

describe('toVehicleFact', () => {
  it('maps a vehicle row to the fact shape, defaulting missing fields to null', () => {
    expect(toVehicleFact(row({ unit_number: null, year: null, make: null, model: null, color: null }))).toEqual({
      plate: 'LUR187',
      unitNumber: null,
      year: null,
      make: null,
      model: null,
      color: null,
    });
  });
});
