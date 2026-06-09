import { describe, it, expect } from 'vitest';
import { normalizePlate, pickKnownVehicle, describeKnownPlate, type KnownPlate } from '../../src/lib/vehicleByPlate';
import type { Vehicle, VehicleRegistryEntry } from '../../src/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

type VehicleLike = Pick<Vehicle, 'id' | 'licensePlate' | 'unitNumber' | 'make' | 'model' | 'year' | 'color'>;

function vehicle(over: Partial<VehicleLike> = {}): VehicleLike {
  return {
    id: 'v1', licensePlate: 'ABC123', unitNumber: '1234567',
    make: 'Toyota', model: 'Camry', year: 2023, color: 'Black',
    ...over,
  };
}

function registry(over: Partial<VehicleRegistryEntry> = {}): VehicleRegistryEntry {
  return {
    id: 'r1', branchId: 'YWG', plate: 'XYZ789',
    needsReview: false, createdAt: '2026-06-01T00:00:00Z', date: '2026-06-01',
    ...over,
  };
}

// ── normalizePlate ────────────────────────────────────────────────────────────

describe('normalizePlate', () => {
  it('trims, upper-cases, and strips inner whitespace', () => {
    expect(normalizePlate('  abc 123 ')).toBe('ABC123');
    expect(normalizePlate('ABC123')).toBe('ABC123');
    expect(normalizePlate('a b c 1 2 3')).toBe('ABC123');
  });
});

// ── pickKnownVehicle ──────────────────────────────────────────────────────────

describe('pickKnownVehicle', () => {
  it('matches a fleet vehicle case/space-insensitively and maps its fields', () => {
    const result = pickKnownVehicle('ABC123', [vehicle({ licensePlate: 'abc 123' })], null);
    expect(result).toEqual({
      source: 'vehicle', plate: 'ABC123',
      unitNumber: '1234567', make: 'Toyota', model: 'Camry', year: 2023, color: 'Black',
      vehicleId: 'v1', registryId: null,
    });
  });

  it('prefers the canonical fleet vehicle over a staged registry entry', () => {
    const result = pickKnownVehicle(
      'ABC123',
      [vehicle()],
      registry({ plate: 'ABC123', make: 'Honda', vehicleId: null }),
    );
    expect(result?.source).toBe('vehicle');
    expect(result?.make).toBe('Toyota'); // fleet record wins, not the registry's Honda
  });

  it('falls back to the registry sighting when the plate is not in the fleet', () => {
    const result = pickKnownVehicle(
      'XYZ789',
      [vehicle()],
      registry({ plate: 'xyz 789', make: 'Ford', model: null, year: null, color: null, vehicleId: 'v9' }),
    );
    expect(result).toEqual({
      source: 'registry', plate: 'XYZ789',
      unitNumber: null, make: 'Ford', model: null, year: null, color: null,
      vehicleId: 'v9', registryId: 'r1',
    });
  });

  it('returns null when the plate is unknown to both stores', () => {
    expect(pickKnownVehicle('NOPE000', [vehicle()], null)).toBeNull();
    expect(pickKnownVehicle('NOPE000', [vehicle()], registry({ plate: 'OTHER11' }))).toBeNull();
  });

  it('ignores a registry entry whose plate does not match the query', () => {
    // defensive: a stale entry must not be mis-attributed to a different plate
    expect(pickKnownVehicle('XYZ789', [], registry({ plate: 'DIFF222' }))).toBeNull();
  });

  it('coalesces missing/undefined registry fields to null', () => {
    const result = pickKnownVehicle('XYZ789', [], registry({ plate: 'XYZ789' }));
    expect(result).toEqual({
      source: 'registry', plate: 'XYZ789',
      unitNumber: null, make: null, model: null, year: null, color: null,
      vehicleId: null, registryId: 'r1',
    });
  });
});

// ── describeKnownPlate ────────────────────────────────────────────────────────

describe('describeKnownPlate', () => {
  const base: KnownPlate = {
    source: 'vehicle', plate: 'ABC123',
    unitNumber: null, make: null, model: null, year: null, color: null,
    vehicleId: null, registryId: null,
  };

  it('joins unit and vehicle when both are known', () => {
    expect(describeKnownPlate({ ...base, unitNumber: '1234567', year: 2023, make: 'Toyota', model: 'Camry' }))
      .toBe('Unit 1234567 · 2023 Toyota Camry');
  });

  it('shows just the unit when the vehicle details are unknown', () => {
    expect(describeKnownPlate({ ...base, unitNumber: '1234567' })).toBe('Unit 1234567');
  });

  it('shows just the vehicle when the unit is unknown', () => {
    expect(describeKnownPlate({ ...base, year: 2022, make: 'Honda', model: 'Civic' })).toBe('2022 Honda Civic');
  });

  it('returns empty string when only the bare plate is known', () => {
    expect(describeKnownPlate(base)).toBe('');
  });
});
