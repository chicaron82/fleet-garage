import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useOffStandardEDV now composes useVehicleByPlate (which reads Auth + VehicleHold
// context) for plate recognition. Stub it so the hook can render without providers.
vi.mock('../../src/hooks/useVehicleByPlate', () => ({
  useVehicleByPlate: () => ({ resolve: async () => null, remember: async () => null }),
}));

import { useOffStandardEDV } from '../../src/hooks/useOffStandardEDV';
import type { Hold, Vehicle } from '../../src/types';

const DEFAULT_PROPS = {
  holds: [],
  vehicles: [],
  resolveName: (id: string) => id,
};

describe('useOffStandardEDV — selectPreset', () => {
  it('clears edvPlate, edvExterior, and edvInterior when preset is re-selected', () => {
    const { result } = renderHook(() => useOffStandardEDV(DEFAULT_PROPS));

    // Simulate: user typed plate + ticked condition during an EDV no-match session
    act(() => { result.current.setEdvPlate('LUR249'); });
    act(() => { result.current.setEdvExterior(true); });
    act(() => { result.current.setEdvInterior(true); });

    expect(result.current.edvPlate).toBe('LUR249');
    expect(result.current.edvExterior).toBe(true);
    expect(result.current.edvInterior).toBe(true);

    // Re-select any preset without discarding — stale fields must clear
    act(() => { result.current.selectPreset('opening_duties'); });

    expect(result.current.edvPlate).toBe('');
    expect(result.current.edvExterior).toBe(false);
    expect(result.current.edvInterior).toBe(false);
  });

  it('also clears match fields on preset re-selection', () => {
    const { result } = renderHook(() => useOffStandardEDV(DEFAULT_PROPS));

    act(() => { result.current.selectPreset('opening_duties'); });

    expect(result.current.edvLinkedHoldId).toBeNull();
    expect(result.current.edvUnitNumber).toBe('');
    expect(result.current.edvManagerName).toBe('');
    expect(result.current.edvNoMatch).toBe(false);
  });
});

describe('useOffStandardEDV — recovery restore', () => {
  it('restoreNoMatchEdv rebuilds the no-match panel from a persisted row', () => {
    const { result } = renderHook(() => useOffStandardEDV(DEFAULT_PROPS));

    act(() => { result.current.restoreNoMatchEdv({ plate: 'LZM524', exterior: true, interior: false }); });

    expect(result.current.edvNoMatch).toBe(true);
    expect(result.current.edvPlate).toBe('LZM524');
    expect(result.current.edvExterior).toBe(true);
    expect(result.current.edvInterior).toBe(false);
  });

  it('restoreLinkedEdv restores the linked hold and derives unit + manager', () => {
    const hold = { id: 'h1', vehicleId: 'v1', release: { approvedById: 'm1' } } as unknown as Hold;
    const vehicle = { id: 'v1', unitNumber: '1234567' } as unknown as Vehicle;
    const { result } = renderHook(() => useOffStandardEDV({
      holds: [hold],
      vehicles: [vehicle],
      resolveName: (id: string) => (id === 'm1' ? 'Manager Mike' : id),
    }));

    act(() => { result.current.restoreLinkedEdv('h1'); });

    expect(result.current.edvLinkedHoldId).toBe('h1');
    expect(result.current.edvUnitNumber).toBe('1234567');
    expect(result.current.edvManagerName).toBe('Manager Mike');
  });

  it('restoreLinkedEdv falls back to the hold’s vehicleId when the vehicle is not loaded yet', () => {
    const hold = { id: 'h2', vehicleId: 'v9', release: { approvedById: 'm1' } } as unknown as Hold;
    const { result } = renderHook(() => useOffStandardEDV({
      holds: [hold],
      vehicles: [],
      resolveName: () => 'Manager Mike',
    }));

    act(() => { result.current.restoreLinkedEdv('h2'); });

    expect(result.current.edvLinkedHoldId).toBe('h2');
    expect(result.current.edvUnitNumber).toBe('v9'); // vehicle not loaded → falls back to vehicleId
  });
});
