import { describe, it, expect } from 'vitest';
import {
  driverTripReducer,
  INITIAL_DRIVER_TRIP_STATE,
  INITIAL_FORM_DRAFT,
  type DriverTripState,
  type FormDraft,
} from '../../src/hooks/driverTripReducer';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Build a form state with overrides applied to the draft. */
function formWith(draft: Partial<FormDraft>): DriverTripState {
  return { phase: 'form', draft: { ...INITIAL_FORM_DRAFT, ...draft }, submitting: false, saveError: false };
}

const TRANSIT_BASE: DriverTripState = {
  phase: 'in_transit',
  trip: {
    inProgressId: 'trip-1', plate: 'ABC123',
    fromLabel: 'Airport', toLabel: 'Washbay',
    vehicleDetails: null, departureTime: '2026-06-04T20:00:00Z',
    notes: '', isShuttle: false, isTeslaRun: false,
    evCableStatus: null, evAdapterStatus: null,
  },
  elapsed: '0m 00s', submitting: false, saveError: false,
};

// ── setFormField ─────────────────────────────────────────────────────────────

describe('driverTripReducer — setFormField', () => {
  it('sets a plain value on the draft', () => {
    const next = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'setFormField', key: 'isTeslaRun', value: true });
    expect(next.phase).toBe('form');
    if (next.phase === 'form') expect(next.draft.isTeslaRun).toBe(true);
  });

  it('resolves an updater against live state (toggle)', () => {
    const once = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'setFormField', key: 'isTeslaRun', value: (v: boolean) => !v });
    if (once.phase === 'form') expect(once.draft.isTeslaRun).toBe(true);
    const twice = driverTripReducer(once, { type: 'setFormField', key: 'isTeslaRun', value: (v: boolean) => !v });
    if (twice.phase === 'form') expect(twice.draft.isTeslaRun).toBe(false);
  });

  it('leaves other draft fields untouched', () => {
    const next = driverTripReducer(formWith({ plate: 'ABC123' }), { type: 'setFormField', key: 'notes', value: 'hi' });
    if (next.phase === 'form') expect(next.draft).toMatchObject({ plate: 'ABC123', notes: 'hi' });
  });

  it('is a no-op in non-form phases', () => {
    const next = driverTripReducer(TRANSIT_BASE, { type: 'setFormField', key: 'plate', value: 'ZZZ999' });
    expect(next).toBe(TRANSIT_BASE);
  });
});

// ── startTrip ────────────────────────────────────────────────────────────────

describe('driverTripReducer — startTrip', () => {
  it('transitions form → in_transit with computed labels and a cleared draft', () => {
    const ready = formWith({ plate: 'JFT881', from: 'Airport', to: 'Washbay', routeStep: 'confirmed' });
    const next = driverTripReducer(ready, { type: 'startTrip', tripId: 'trip-x', departureTime: '2026-06-04T20:00:00Z' });
    expect(next.phase).toBe('in_transit');
    if (next.phase === 'in_transit') {
      expect(next.trip.plate).toBe('JFT881');
      expect(next.trip.fromLabel).toBe('Airport');
      expect(next.trip.toLabel).toBe('Washbay');
      expect(next.trip.inProgressId).toBe('trip-x');
      expect(next.elapsed).toBe('0m 00s');
    }
  });

  it('resolves "Other" labels from customFrom/customTo', () => {
    const ready = formWith({ from: 'Other', customFrom: 'Detail bay', to: 'Other', customTo: 'Fuel bay', routeStep: 'confirmed' });
    const next = driverTripReducer(ready, { type: 'startTrip', tripId: 'x', departureTime: '2026-06-04T20:00:00Z' });
    if (next.phase === 'in_transit') {
      expect(next.trip.fromLabel).toBe('Detail bay');
      expect(next.trip.toLabel).toBe('Fuel bay');
    }
  });

  it('is a no-op when not in form phase', () => {
    expect(driverTripReducer(TRANSIT_BASE, { type: 'startTrip', tripId: 'x', departureTime: 'now' })).toBe(TRANSIT_BASE);
  });
});

// ── arriveTrip ───────────────────────────────────────────────────────────────

describe('driverTripReducer — arriveTrip', () => {
  it('transitions in_transit → complete with the arrival time', () => {
    const next = driverTripReducer(TRANSIT_BASE, { type: 'arriveTrip', arrivalTime: '2026-06-04T20:30:00Z' });
    expect(next.phase).toBe('complete');
    if (next.phase === 'complete') {
      expect(next.trip.arrivalTime).toBe('2026-06-04T20:30:00Z');
      expect(next.trip.plate).toBe('ABC123');
    }
  });

  it('is a no-op in form phase', () => {
    expect(driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'arriveTrip', arrivalTime: 'now' })).toBe(INITIAL_DRIVER_TRIP_STATE);
  });
});

// ── locationTap state machine ────────────────────────────────────────────────

describe('driverTripReducer — locationTap state machine', () => {
  it('origin tap sets the start and advances to destination', () => {
    const next = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'locationTap', loc: 'Airport' });
    if (next.phase === 'form') {
      expect(next.draft.from).toBe('Airport');
      expect(next.draft.routeStep).toBe('destination');
    }
  });

  it('a different destination confirms the route', () => {
    const next = driverTripReducer(formWith({ from: 'Airport', routeStep: 'destination' }), { type: 'locationTap', loc: 'Washbay' });
    if (next.phase === 'form') {
      expect(next.draft.to).toBe('Washbay');
      expect(next.draft.routeStep).toBe('confirmed');
    }
  });

  it('re-tapping the origin while choosing destination backs out to origin', () => {
    const next = driverTripReducer(formWith({ from: 'Airport', routeStep: 'destination' }), { type: 'locationTap', loc: 'Airport' });
    if (next.phase === 'form') {
      expect(next.draft.from).toBeNull();
      expect(next.draft.routeStep).toBe('origin');
    }
  });

  it('is a no-op once confirmed (buttons are hidden then anyway)', () => {
    const confirmed = formWith({ from: 'Airport', to: 'Washbay', routeStep: 'confirmed' });
    expect(driverTripReducer(confirmed, { type: 'locationTap', loc: 'Other' })).toBe(confirmed);
  });
});

// ── routeReset ───────────────────────────────────────────────────────────────

describe('driverTripReducer — routeReset', () => {
  it('clears both ends + custom text and returns to origin', () => {
    const dirty = formWith({ from: 'Other', to: 'Washbay', customFrom: 'Detail bay', customTo: '', routeStep: 'confirmed' });
    const next = driverTripReducer(dirty, { type: 'routeReset' });
    if (next.phase === 'form') {
      expect(next.draft).toMatchObject({ from: null, to: null, customFrom: '', customTo: '', routeStep: 'origin' });
    }
  });

  it('leaves non-route fields alone', () => {
    const next = driverTripReducer(formWith({ plate: 'ABC123', from: 'Airport', routeStep: 'destination' }), { type: 'routeReset' });
    if (next.phase === 'form') expect(next.draft.plate).toBe('ABC123');
  });
});

// ── reset ────────────────────────────────────────────────────────────────────

describe('driverTripReducer — reset', () => {
  it('returns the full initial state in one shot from any phase', () => {
    expect(driverTripReducer(TRANSIT_BASE, { type: 'reset' })).toEqual(INITIAL_DRIVER_TRIP_STATE);
  });

  it('also resets from a dirty form state', () => {
    const dirty = formWith({ plate: 'ABC123', from: 'Airport', routeStep: 'destination', isTeslaRun: true });
    expect(driverTripReducer(dirty, { type: 'reset' })).toEqual(INITIAL_DRIVER_TRIP_STATE);
  });
});

// ── setSubmitting / setSaveError ─────────────────────────────────────────────

describe('driverTripReducer — setSubmitting / setSaveError', () => {
  it('sets submitting in form phase', () => {
    const next = driverTripReducer(INITIAL_DRIVER_TRIP_STATE, { type: 'setSubmitting', value: true });
    if (next.phase === 'form') expect(next.submitting).toBe(true);
  });

  it('sets saveError in transit phase', () => {
    const next = driverTripReducer(TRANSIT_BASE, { type: 'setSaveError', value: true });
    if (next.phase === 'in_transit') expect(next.saveError).toBe(true);
  });

  it('is a no-op in complete phase', () => {
    const complete: DriverTripState = { phase: 'complete', trip: { ...TRANSIT_BASE.trip, arrivalTime: '2026-06-04T20:30:00Z' } };
    expect(driverTripReducer(complete, { type: 'setSubmitting', value: true })).toBe(complete);
  });
});
