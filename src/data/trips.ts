import type { BranchId } from '../types';

// The trip-run shape used across the movement log (live rows map into this). The old
// MOCK_TRIPS demo dataset was removed with the demo-side (docs/ticket-remove-demo-side.md).

export interface TripRun {
  id: string;
  vehicleUnit: string;
  vehiclePlate: string;
  vehicleMake?: string;
  vehicleModel?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  tripType: 'clean' | 'dirty' | 'customer' | 'transfer';
  departLocation: string;
  arriveLocation: string;
  departTime: string;
  arriveTime: string;
  gasLevel: string;
  odometer: number;
  driverId: string;
  notes?: string;
  // VSA Movement Log fields
  isVsaInterruption?: boolean;
  oneWay?: boolean;  // ended at destination (airport flip), no return — vs round trip
  authorization?: 'MANAGEMENT' | 'LEAD_VSA' | 'PERSONAL';
  reason?: 'ROUTINE' | 'COVERAGE_ASSIST' | 'CODE_RED' | 'OTHER';
  queueAtDeparture?: string;
  fuelOnArrival?: string;
  condition?: 'CLEAN' | 'DIRTY';
  branchId: BranchId;
}
