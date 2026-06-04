import { describe, it, expect } from 'vitest';
import {
  driverTripReducer, INITIAL_DRIVER_TRIP_STATE, type DriverTripState,
} from '../../src/hooks/driverTripReducer';

const at = (over: Partial<DriverTripState>): DriverTripState => ({ ...INITIAL_DRIVER_TRIP_STATE, ...over });

describe('driverTripReducer — patch', () => {
  it('shallow-merges the patch', () => {
    const next = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'patch', patch: { plate: 'ABC123', isShuttle: true } });
    expect(next.plate).toBe('ABC123');
    expect(next.isShuttle).toBe(true);
    expect(next.routeStep).toBe('origin'); // untouched
  });
});

describe('driverTripReducer — locationTap state machine', () => {
  it('origin tap sets the start and advances to destination', () => {
    const next = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'locationTap', loc: 'Airport' });
    expect(next.from).toBe('Airport');
    expect(next.routeStep).toBe('destination');
  });

  it('a different destination confirms the route', () => {
    const next = driverTripReducer(at({ from: 'Airport', routeStep: 'destination' }), { type: 'locationTap', loc: 'Washbay' });
    expect(next.to).toBe('Washbay');
    expect(next.routeStep).toBe('confirmed');
  });

  it('re-tapping the origin while choosing destination backs out to origin', () => {
    const next = driverTripReducer(at({ from: 'Airport', routeStep: 'destination' }), { type: 'locationTap', loc: 'Airport' });
    expect(next.from).toBeNull();
    expect(next.routeStep).toBe('origin');
  });

  it('is a no-op once confirmed (buttons are hidden then anyway)', () => {
    const confirmed = at({ from: 'Airport', to: 'Washbay', routeStep: 'confirmed' });
    expect(driverTripReducer(confirmed, { type: 'locationTap', loc: 'Other' })).toBe(confirmed);
  });
});

describe('driverTripReducer — routeReset', () => {
  it('clears both ends + custom text and returns to origin', () => {
    const dirty = at({ from: 'Other', to: 'Washbay', customFrom: 'Detail bay', customTo: '', routeStep: 'confirmed' });
    const next = driverTripReducer(dirty, { type: 'routeReset' });
    expect(next).toMatchObject({ from: null, to: null, customFrom: '', customTo: '', routeStep: 'origin' });
  });

  it('leaves non-route fields alone', () => {
    const next = driverTripReducer(at({ plate: 'ABC123', from: 'Airport', routeStep: 'destination' }), { type: 'routeReset' });
    expect(next.plate).toBe('ABC123');
  });
});

describe('driverTripReducer — reset', () => {
  it('returns the full initial state in one shot (the orphan-bug footgun fix)', () => {
    const live = at({
      liveState: 'in_transit', plate: 'ABC123', from: 'Airport', to: 'Washbay',
      routeStep: 'confirmed', departureTime: '2026-06-04T20:00:00Z', inProgressId: 'trip-1',
      isTeslaRun: true, evCableStatus: 'missing', notes: 'x',
    });
    expect(driverTripReducer(live, { type: 'reset' })).toEqual(INITIAL_DRIVER_TRIP_STATE);
  });
});
