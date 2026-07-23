// Behaviour-locking net for useDriverLiveTrip — the most stateful hook in the app.
// Written before the useReducer consolidation; updated for the discriminated-union
// refactor. Locks the load-bearing transitions: route build → canStart, write-first
// start, arrive → complete, and the reset/abandon orphan-delete guard.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { User } from '../../src/types';

const TEST_USER: User = {
  id:         'driver-1',
  employeeId: 'EMP200',
  name:       'Test Driver',
  role:       'VSA',
  branchId:   'YWG',
};

const { writeOrEnqueueSpy, updateEVAssetsSpy, pushNotificationSpy, NON_TESLA } = vi.hoisted(() => ({
  writeOrEnqueueSpy:   vi.fn(),
  updateEVAssetsSpy:   vi.fn(),
  pushNotificationSpy: vi.fn(),
  NON_TESLA: { isTesla: false, vehicle: null, lastCable: null, lastAdapter: null },
}));

vi.mock('../../src/lib/haptics', () => ({
  hapticLight:  vi.fn(),
  hapticMedium: vi.fn(),
}));

vi.mock('../../src/lib/vsaTripWrite', () => ({
  writeOrEnqueue: (...args: unknown[]) => writeOrEnqueueSpy(...args),
}));

vi.mock('../../src/lib/ev-detection', () => ({
  detectTeslaByPlate: vi.fn().mockResolvedValue(NON_TESLA),
  searchVehicles:     vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/lib/garage-uploads', () => ({
  pushNotification: (...args: unknown[]) => pushNotificationSpy(...args),
}));

vi.mock('../../src/lib/offlineQueue', () => ({
  enqueueOfflineAction: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  writeWithRefresh: vi.fn().mockImplementation((cb: () => unknown) => cb()),
  supabase: {
    from: () => ({ delete: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));

vi.mock('../../src/hooks/useInProgressRecovery', () => ({
  useInProgressRecovery: vi.fn(),
}));

vi.mock('../../src/context/VehicleHoldContext', () => ({
  useVehicleHoldContext: () => ({ updateVehicleEVAssets: updateEVAssetsSpy }),
}));

import { useDriverLiveTrip } from '../../src/hooks/useDriverLiveTrip';

function setup() {
  const onTripComplete = vi.fn();
  const view = renderHook(() => useDriverLiveTrip({ user: TEST_USER, onTripComplete }));
  return { ...view, onTripComplete };
}

/** Drive the route picker + plate to the point where canStart is true. */
function makeReady(result: { current: ReturnType<typeof useDriverLiveTrip> }) {
  act(() => {
    if (result.current.phase === 'form') {
      result.current.setFormField('plate')('ABC123');
      result.current.handleLocationTap('Airport');
      result.current.handleLocationTap('Washbay');
    }
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  writeOrEnqueueSpy.mockResolvedValue({ ok: true });
  updateEVAssetsSpy.mockResolvedValue(undefined);
  pushNotificationSpy.mockResolvedValue(undefined);
});

// ── Route building ────────────────────────────────────────────────────────────

describe('route picker', () => {
  it('walks origin → destination → confirmed', () => {
    const { result } = setup();
    expect(result.current.phase).toBe('form');
    if (result.current.phase !== 'form') return;

    expect(result.current.routeStep).toBe('origin');

    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Airport'); });
    if (result.current.phase === 'form') {
      expect(result.current.from).toBe('Airport');
      expect(result.current.routeStep).toBe('destination');
    }

    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Washbay'); });
    if (result.current.phase === 'form') {
      expect(result.current.to).toBe('Washbay');
      expect(result.current.routeStep).toBe('confirmed');
    }
  });

  it('tapping the origin again while choosing destination resets to origin', () => {
    const { result } = setup();
    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Airport'); });
    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Airport'); });
    if (result.current.phase === 'form') {
      expect(result.current.from).toBeNull();
      expect(result.current.routeStep).toBe('origin');
    }
  });

  it('handleRouteReset clears the whole route', () => {
    const { result } = setup();
    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Airport'); });
    act(() => { if (result.current.phase === 'form') result.current.handleLocationTap('Washbay'); });
    act(() => { if (result.current.phase === 'form') result.current.handleRouteReset(); });
    if (result.current.phase === 'form') {
      expect(result.current.from).toBeNull();
      expect(result.current.to).toBeNull();
      expect(result.current.routeStep).toBe('origin');
    }
  });
});

// ── canStart gate ──────────────────────────────────────────────────────────

describe('canStart', () => {
  it('is false until plate + a confirmed route exist', () => {
    const { result } = setup();
    if (result.current.phase === 'form') expect(result.current.canStart).toBe(false);
    makeReady(result);
    if (result.current.phase === 'form') expect(result.current.canStart).toBe(true);
  });

  it('an "Other" origin with no custom text blocks start', () => {
    const { result } = setup();
    act(() => {
      if (result.current.phase === 'form') {
        result.current.setFormField('plate')('ABC123');
        result.current.handleLocationTap('Other');
        result.current.handleLocationTap('Washbay');
      }
    });
    if (result.current.phase === 'form') {
      expect(result.current.from).toBe('Other');
      expect(result.current.canStart).toBe(false);

      act(() => { if (result.current.phase === 'form') result.current.setFormField('customFrom')('Detail bay'); });
      if (result.current.phase === 'form') {
        expect(result.current.fromLabel).toBe('Detail bay');
        expect(result.current.canStart).toBe(true);
      }
    }
  });
});

// ── Write-first start ─────────────────────────────────────────────────────────

describe('handleStart (write-first)', () => {
  it('inserts then flips to in_transit with a departure + in-progress id', async () => {
    const { result } = setup();
    makeReady(result);
    await act(async () => {
      if (result.current.phase === 'form') await result.current.handleStart();
    });

    expect(writeOrEnqueueSpy).toHaveBeenCalledWith('insert', expect.objectContaining({
      vehicle_plate: 'ABC123', status: 'in_progress',
    }));
    expect(result.current.phase).toBe('in_transit');
    if (result.current.phase === 'in_transit') {
      expect(result.current.departureTime).not.toBe('');
      expect(result.current.saveError).toBe(false);
    }
  });

  it('a failed insert sets saveError and stays on the form', async () => {
    const { result } = setup();
    makeReady(result);
    writeOrEnqueueSpy.mockResolvedValueOnce({ ok: false });
    await act(async () => {
      if (result.current.phase === 'form') await result.current.handleStart();
    });

    expect(result.current.phase).toBe('form');
    if (result.current.phase === 'form') expect(result.current.saveError).toBe(true);
  });
});

// ── Arrive → complete ─────────────────────────────────────────────────────────

describe('handleArrived', () => {
  it('completes the in-progress trip and reports it', async () => {
    const { result, onTripComplete } = setup();
    makeReady(result);
    await act(async () => {
      if (result.current.phase === 'form') await result.current.handleStart();
    });
    await act(async () => {
      if (result.current.phase === 'in_transit') await result.current.handleArrived();
    });

    expect(writeOrEnqueueSpy).toHaveBeenCalledWith(
      'update', expect.objectContaining({ status: 'complete' }), 'id', expect.any(String),
    );
    expect(onTripComplete).toHaveBeenCalledTimes(1);
    expect(result.current.phase).toBe('complete');
    if (result.current.phase === 'complete') {
      expect(result.current.arrivalTime).toBeTruthy();
    }
  });
});

// ── Reset / abandon (orphan-bug guard) ───────────────────────────────────────

describe('handleReset', () => {
  it('from the form does NOT delete anything and clears state', () => {
    const { result } = setup();
    act(() => {
      if (result.current.phase === 'form') result.current.setFormField('plate')('ABC123');
    });
    act(() => result.current.handleReset());
    expect(writeOrEnqueueSpy).not.toHaveBeenCalledWith('delete', expect.anything(), expect.anything(), expect.anything());
    expect(result.current.phase).toBe('form');
    if (result.current.phase === 'form') expect(result.current.plate).toBe('');
  });

  it('abandoning an in-transit trip deletes the orphan in-progress row', async () => {
    const { result } = setup();
    makeReady(result);
    await act(async () => {
      if (result.current.phase === 'form') await result.current.handleStart();
    });
    expect(result.current.phase).toBe('in_transit');

    act(() => result.current.handleReset());

    expect(writeOrEnqueueSpy).toHaveBeenCalledWith('delete', {}, 'id', expect.any(String));
    expect(result.current.phase).toBe('form');
    if (result.current.phase === 'form') {
      expect(result.current.plate).toBe('');
      expect(result.current.from).toBeNull();
    }
  });
});
