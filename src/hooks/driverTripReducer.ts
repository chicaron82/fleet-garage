// State core for useDriverLiveTrip — extracted as a pure reducer so the (most
// stateful) hook stays under the line cap and the transitions are unit-testable.
//
// State is a discriminated union: form | in_transit | complete. Data only exists
// in the phase where it's valid — impossible states are not representable. The
// `reset` action always returns INITIAL (form) in one shot; `startTrip` and
// `arriveTrip` are atomic phase transitions that carry the data they need forward
// so no field is accessible in the wrong phase.

import type { EvAssetStatus } from '../types';
import type { VehicleSearchResult } from '../lib/ev-detection';

export const LOCATIONS = ['Airport', 'Washbay', 'Other'] as const;
export type Location  = typeof LOCATIONS[number];
export type RouteStep = 'origin' | 'destination' | 'confirmed';

export type VehicleDetails = { make: string; model: string; year: number; color: string };

// ── Phase-specific data shapes ───────────────────────────────────────────────

export interface FormDraft {
  routeStep:        RouteStep;
  from:             Location | null;
  to:               Location | null;
  customFrom:       string;
  customTo:         string;
  plate:            string;
  isShuttle:        boolean;
  notes:            string;
  isTeslaRun:       boolean;
  evCableStatus:    EvAssetStatus | null;
  evAdapterStatus:  EvAssetStatus | null;
  vehicleDetails:   VehicleDetails | null;
  evVehicleId:      string | null;
  plateSuggestions: VehicleSearchResult[];
  showSuggestions:  boolean;
}

// Carries the display + write data that must survive into transit and complete.
// `isShuttle`/`isTeslaRun`/`evCableStatus`/`evAdapterStatus` are kept so the
// arrival fallback-insert can reproduce the full payload if the start write failed.
export interface TripRecord {
  inProgressId:   string | null;
  plate:          string;   // already uppercased
  fromLabel:      string;
  toLabel:        string;
  vehicleDetails: VehicleDetails | null;
  departureTime:  string;
  notes:          string;   // editable during transit
  isShuttle:      boolean;
  isTeslaRun:     boolean;
  evCableStatus:  EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
}

// ── Discriminated union ──────────────────────────────────────────────────────

export type DriverTripState =
  | { phase: 'form';       draft: FormDraft;                                submitting: boolean; saveError: boolean }
  | { phase: 'in_transit'; trip: TripRecord;              elapsed: string;  submitting: boolean; saveError: boolean }
  | { phase: 'complete';   trip: TripRecord & { arrivalTime: string } };

export const INITIAL_FORM_DRAFT: FormDraft = {
  routeStep: 'origin',
  from: null, to: null,
  customFrom: '', customTo: '',
  plate: '',
  isShuttle: false,
  notes: '',
  isTeslaRun: false,
  evCableStatus: null, evAdapterStatus: null,
  vehicleDetails: null, evVehicleId: null,
  plateSuggestions: [],
  showSuggestions: false,
};

export const INITIAL_DRIVER_TRIP_STATE: DriverTripState = {
  phase: 'form',
  draft: { ...INITIAL_FORM_DRAFT },
  submitting: false,
  saveError: false,
};

// ── Actions ──────────────────────────────────────────────────────────────────

export type DriverTripAction =
  | { type: 'setFormField';       key: keyof FormDraft; value: unknown }
  | { type: 'startTrip';          tripId: string; departureTime: string }
  | { type: 'setElapsed';         elapsed: string }
  | { type: 'setTransitNotes';    notes: string }
  | { type: 'setSubmitting';      value: boolean }
  | { type: 'setSaveError';       value: boolean }
  | { type: 'arriveTrip';         arrivalTime: string }
  | { type: 'patchVehicleDetails'; vehicleDetails: VehicleDetails | null; evVehicleId: string | null }
  | { type: 'recoverInTransit';   tripId: string | null; plate: string; fromLabel: string; toLabel: string; departureTime: string; isShuttle: boolean; notes: string; vehicleDetails?: VehicleDetails | null }
  | { type: 'locationTap';        loc: Location }
  | { type: 'routeReset' }
  | { type: 'reset' };

// ── Reducer ──────────────────────────────────────────────────────────────────

export function driverTripReducer(state: DriverTripState, action: DriverTripAction): DriverTripState {
  switch (action.type) {

    case 'setFormField': {
      if (state.phase !== 'form') return state;
      const prev = state.draft[action.key];
      const next = typeof action.value === 'function'
        ? (action.value as (p: unknown) => unknown)(prev)
        : action.value;
      return { ...state, draft: { ...state.draft, [action.key]: next } };
    }

    case 'startTrip': {
      if (state.phase !== 'form') return state;
      const { from, to, customFrom, customTo, plate, isShuttle, notes,
              vehicleDetails, isTeslaRun, evCableStatus, evAdapterStatus } = state.draft;
      const fromLabel = from === 'Other' ? (customFrom || 'Other') : (from ?? '');
      const toLabel   = to   === 'Other' ? (customTo   || 'Other') : (to   ?? '');
      return {
        phase: 'in_transit',
        trip: {
          inProgressId: action.tripId,
          plate: plate.trim().toUpperCase(),
          fromLabel, toLabel, vehicleDetails,
          departureTime: action.departureTime,
          notes, isShuttle, isTeslaRun, evCableStatus, evAdapterStatus,
        },
        elapsed: '0m 00s',
        submitting: false,
        saveError: false,
      };
    }

    case 'setElapsed':
      if (state.phase !== 'in_transit') return state;
      return { ...state, elapsed: action.elapsed };

    case 'setTransitNotes':
      if (state.phase !== 'in_transit') return state;
      return { ...state, trip: { ...state.trip, notes: action.notes } };

    case 'setSubmitting':
      if (state.phase === 'complete') return state;
      return { ...state, submitting: action.value };

    case 'setSaveError':
      if (state.phase === 'complete') return state;
      return { ...state, saveError: action.value };

    case 'arriveTrip': {
      if (state.phase !== 'in_transit') return state;
      return { phase: 'complete', trip: { ...state.trip, arrivalTime: action.arrivalTime } };
    }

    case 'patchVehicleDetails': {
      if (state.phase === 'form') {
        return { ...state, draft: { ...state.draft, vehicleDetails: action.vehicleDetails, evVehicleId: action.evVehicleId } };
      }
      if (state.phase === 'in_transit') {
        return { ...state, trip: { ...state.trip, vehicleDetails: action.vehicleDetails } };
      }
      return state;
    }

    case 'recoverInTransit':
      return {
        phase: 'in_transit',
        trip: {
          inProgressId:   action.tripId,
          plate:          action.plate,
          fromLabel:      action.fromLabel,
          toLabel:        action.toLabel,
          vehicleDetails: action.vehicleDetails ?? null,
          departureTime:  action.departureTime,
          notes:          action.notes,
          isShuttle:      action.isShuttle,
          isTeslaRun:     false,
          evCableStatus:  null,
          evAdapterStatus: null,
        },
        elapsed: '0m 00s',
        submitting: false,
        saveError: false,
      };

    case 'locationTap': {
      if (state.phase !== 'form') return state;
      const { routeStep, from } = state.draft;
      if (routeStep === 'origin') {
        return { ...state, draft: { ...state.draft, from: action.loc, routeStep: 'destination' } };
      }
      if (routeStep === 'destination') {
        if (action.loc === from) return { ...state, draft: { ...state.draft, from: null, routeStep: 'origin' } };
        return { ...state, draft: { ...state.draft, to: action.loc, routeStep: 'confirmed' } };
      }
      return state; // confirmed — buttons hidden, ignore
    }

    case 'routeReset':
      if (state.phase !== 'form') return state;
      return { ...state, draft: { ...state.draft, from: null, to: null, customFrom: '', customTo: '', routeStep: 'origin' } };

    case 'reset':
      return { ...INITIAL_DRIVER_TRIP_STATE };

    default:
      return state;
  }
}
