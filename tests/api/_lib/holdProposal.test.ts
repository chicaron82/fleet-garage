import { describe, it, expect } from 'vitest';
import {
  buildHoldProposal,
  buildRegisterHoldProposal,
  buildUpdateVehicleProposal,
  buildUpdateAndHoldProposal,
  describeProposal,
  describeNewVehicle,
} from '../../../api/_lib/holdProposal';

const vehicle = { vehicleId: 'v1', plate: 'LFJ438', label: 'Unit 1234 · 2025 Hyundai Tucson (Gray)' };
const newVehicle = {
  unitNumber: '9001',
  plate: 'LUR187',
  make: 'Ford',
  model: 'Escape',
  year: 2024,
  color: 'Blue',
};

describe('buildHoldProposal', () => {
  it('assembles a hold proposal with no write', () => {
    const p = buildHoldProposal(vehicle, 'damage', 'bumper scuff');
    expect(p).toEqual({ kind: 'hold', vehicle, holdType: 'damage', damageDescription: 'bumper scuff' });
  });
});

describe('buildRegisterHoldProposal', () => {
  it('assembles a register-and-hold proposal with no write', () => {
    const p = buildRegisterHoldProposal(newVehicle, 'damage', 'cracked windshield');
    expect(p).toEqual({
      kind: 'register_and_hold',
      newVehicle,
      holdType: 'damage',
      damageDescription: 'cracked windshield',
    });
  });
});

describe('buildUpdateVehicleProposal', () => {
  it('assembles a backfill proposal with no write', () => {
    const fills = [{ field: 'color' as const, value: 'Gray' }, { field: 'year' as const, value: 2026 }];
    const p = buildUpdateVehicleProposal('v1', 'LUR554', fills);
    expect(p).toEqual({ kind: 'update_vehicle', vehicleId: 'v1', plate: 'LUR554', fills });
  });
});

describe('buildUpdateAndHoldProposal', () => {
  it('assembles a combined backfill-and-hold proposal with no write', () => {
    const fills = [{ field: 'model' as const, value: 'Corolla' }, { field: 'year' as const, value: 2026 }];
    const p = buildUpdateAndHoldProposal('v1', 'LUR318', fills, 'damage', 'rear quarter scrape');
    expect(p).toEqual({
      kind: 'update_and_hold',
      vehicleId: 'v1',
      plate: 'LUR318',
      fills,
      holdType: 'damage',
      damageDescription: 'rear quarter scrape',
    });
  });
});

describe('describeNewVehicle', () => {
  it('builds the identity line for an unregistered vehicle', () => {
    expect(describeNewVehicle(newVehicle)).toBe('Unit 9001 · 2024 Ford Escape (Blue)');
  });
});

describe('describeProposal', () => {
  it('summarises a hold proposal', () => {
    expect(describeProposal(buildHoldProposal(vehicle, 'damage', 'bumper scuff'))).toBe(
      'damage hold on Unit 1234 · 2025 Hyundai Tucson (Gray) — bumper scuff',
    );
  });

  it('omits the dash when no description', () => {
    expect(describeProposal(buildHoldProposal(vehicle, 'mechanical', ''))).toBe(
      'mechanical hold on Unit 1234 · 2025 Hyundai Tucson (Gray)',
    );
  });

  it('summarises a register-and-hold proposal', () => {
    expect(describeProposal(buildRegisterHoldProposal(newVehicle, 'damage', 'cracked windshield'))).toBe(
      'register Unit 9001 · 2024 Ford Escape (Blue) + damage hold — cracked windshield',
    );
  });

  it('summarises a backfill proposal', () => {
    const fills = [{ field: 'color' as const, value: 'Gray' }, { field: 'year' as const, value: 2026 }];
    expect(describeProposal(buildUpdateVehicleProposal('v1', 'LUR554', fills))).toBe(
      'backfill LUR554: color Gray, year 2026',
    );
  });

  it('summarises a combined backfill-and-hold proposal', () => {
    const fills = [{ field: 'model' as const, value: 'Corolla' }, { field: 'year' as const, value: 2026 }];
    expect(describeProposal(buildUpdateAndHoldProposal('v1', 'LUR318', fills, 'damage', 'rear quarter scrape'))).toBe(
      'backfill model Corolla, year 2026 + damage hold on LUR318 — rear quarter scrape',
    );
  });

  it('summarises a combined hold with no fills (blanks already full)', () => {
    expect(describeProposal(buildUpdateAndHoldProposal('v1', 'LUR318', [], 'damage', 'bumper crack'))).toBe(
      'damage hold on LUR318 — bumper crack',
    );
  });
});
