import { describe, it, expect } from 'vitest';
import { buildHoldProposal, describeProposal } from './holdProposal';

const vehicle = { vehicleId: 'v1', plate: 'LFJ438', label: 'Unit 1234 · 2025 Hyundai Tucson (Gray)' };

describe('buildHoldProposal', () => {
  it('assembles a hold proposal with no write', () => {
    const p = buildHoldProposal(vehicle, 'damage', 'bumper scuff');
    expect(p).toEqual({ kind: 'hold', vehicle, holdType: 'damage', damageDescription: 'bumper scuff' });
  });
});

describe('describeProposal', () => {
  it('reads as a one-line summary', () => {
    expect(describeProposal(buildHoldProposal(vehicle, 'damage', 'bumper scuff'))).toBe(
      'damage hold on Unit 1234 · 2025 Hyundai Tucson (Gray) — bumper scuff',
    );
  });

  it('omits the dash when no description', () => {
    expect(describeProposal(buildHoldProposal(vehicle, 'mechanical', ''))).toBe(
      'mechanical hold on Unit 1234 · 2025 Hyundai Tucson (Gray)',
    );
  });
});
