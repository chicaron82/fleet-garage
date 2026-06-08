import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// useOffStandardEDV now composes useVehicleByPlate (which reads Auth + VehicleHold
// context) for plate recognition. Stub it so the hook can render without providers.
vi.mock('../../src/hooks/useVehicleByPlate', () => ({
  useVehicleByPlate: () => ({ resolve: async () => null, remember: async () => null }),
}));

import { useOffStandardEDV } from '../../src/hooks/useOffStandardEDV';

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
