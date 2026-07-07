import { describe, it, expect } from 'vitest';
import {
  buildOverflowProposal,
  describeOverflowProposal,
  OVERFLOW_DESTINATIONS,
  type OverflowVehicle,
} from '../../../api/_lib/overflowProposal';

const veh = (plate: string, unresolved = false): OverflowVehicle => ({
  plate,
  unit: unresolved ? null : '542',
  label: unresolved ? plate : 'Unit 542',
  unresolved,
});

describe('buildOverflowProposal', () => {
  it('carries the destination and vehicles verbatim under the overflow_log kind', () => {
    const vehicles = [veh('ABC123'), veh('XYZ789', true)];
    expect(buildOverflowProposal('AV Flight', vehicles)).toEqual({
      kind: 'overflow_log',
      destination: 'AV Flight',
      vehicles,
    });
  });

  it('builds for every known overflow destination', () => {
    for (const d of OVERFLOW_DESTINATIONS) {
      expect(buildOverflowProposal(d, []).destination).toBe(d);
    }
  });
});

describe('describeOverflowProposal', () => {
  it('pluralizes the count and names the destination', () => {
    expect(describeOverflowProposal(buildOverflowProposal('FastAir', [veh('A1'), veh('B2')]))).toBe(
      'log 2 vehicles sent to FastAir',
    );
  });

  it('uses the singular for exactly one vehicle', () => {
    expect(describeOverflowProposal(buildOverflowProposal('Airport', [veh('A1')]))).toBe(
      'log 1 vehicle sent to Airport',
    );
  });

  it('reads an empty batch as plural zero', () => {
    expect(describeOverflowProposal(buildOverflowProposal('AV Flight', []))).toBe(
      'log 0 vehicles sent to AV Flight',
    );
  });
});
