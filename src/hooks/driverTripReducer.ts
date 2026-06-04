// State core for useDriverLiveTrip — extracted as a pure reducer so the (most
// stateful) hook stays under the line cap and the transitions are unit-testable.
//
// The hook owns side effects (haptics, Supabase writes, recovery queries); this
// file owns only how state moves. `reset` returns INITIAL in one shot — no more
// clearing 20 fields by hand (the footgun behind the orphan-trip bug). The route
// picker is a small state machine here rather than branching setters in the hook.

import type { EvAssetStatus } from '../types';
import type { VehicleSearchResult } from '../lib/ev-detection';

export const LOCATIONS = ['Airport', 'Washbay', 'Other'] as const;
export type Location = typeof LOCATIONS[number];
export type RouteStep = 'origin' | 'destination' | 'confirmed';

export interface DriverTripState {
  liveState: 'form' | 'in_transit' | 'complete';
  routeStep: RouteStep;
  from: Location | null;
  to: Location | null;
  customFrom: string;
  customTo: string;
  plate: string;
  isShuttle: boolean;
  notes: string;
  departureTime: string;
  arrivalTime: string;
  elapsed: string;
  submitting: boolean;
  saveError: boolean;
  isTeslaRun: boolean;
  evCableStatus: EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
  vehicleDetails: { make: string; model: string; year: number; color: string } | null;
  evVehicleId: string | null;
  inProgressId: string | null;
  plateSuggestions: VehicleSearchResult[];
  showSuggestions: boolean;
}

export const INITIAL_DRIVER_TRIP_STATE: DriverTripState = {
  liveState: 'form',
  routeStep: 'origin',
  from: null,
  to: null,
  customFrom: '',
  customTo: '',
  plate: '',
  isShuttle: false,
  notes: '',
  departureTime: '',
  arrivalTime: '',
  elapsed: '',
  submitting: false,
  saveError: false,
  isTeslaRun: false,
  evCableStatus: null,
  evAdapterStatus: null,
  vehicleDetails: null,
  evVehicleId: null,
  inProgressId: null,
  plateSuggestions: [],
  showSuggestions: false,
};

export type DriverTripAction =
  | { type: 'patch'; patch: Partial<DriverTripState> }
  | { type: 'locationTap'; loc: Location }
  | { type: 'routeReset' }
  | { type: 'reset' };

export function driverTripReducer(state: DriverTripState, action: DriverTripAction): DriverTripState {
  switch (action.type) {
    case 'patch':
      return { ...state, ...action.patch };

    case 'locationTap': {
      // origin → pick start; destination → re-tapping the origin backs out,
      // any other choice confirms the route.
      if (state.routeStep === 'origin') {
        return { ...state, from: action.loc, routeStep: 'destination' };
      }
      if (state.routeStep === 'destination') {
        if (action.loc === state.from) return { ...state, from: null, routeStep: 'origin' };
        return { ...state, to: action.loc, routeStep: 'confirmed' };
      }
      return state; // confirmed → buttons aren't shown; ignore
    }

    case 'routeReset':
      return { ...state, from: null, to: null, customFrom: '', customTo: '', routeStep: 'origin' };

    case 'reset':
      return { ...INITIAL_DRIVER_TRIP_STATE };

    default:
      return state;
  }
}
