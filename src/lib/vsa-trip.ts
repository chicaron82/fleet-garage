import type { EvAssetStatus } from '../types';

// ── Types ──────────────────────────────────────────────────────────────────────

export type Reason         = 'ROUTINE' | 'COVERAGE_ASSIST' | 'CODE_RED' | 'OTHER';
export type Authorization  = 'MANAGEMENT' | 'LEAD_VSA' | 'PERSONAL';
export type QueueSnapshot  = '0' | '~5' | '10+';
export type FuelLevel      = number;
export type TripState      = 'form' | 'in_transit' | 'complete';

// ── Constants ─────────────────────────────────────────────────────────────────

export const FUEL_LABELS: Record<number, string> = {
  0: 'Empty', 1: '1/8', 2: '1/4', 3: '3/8',
  4: '1/2',  5: '5/8', 6: '3/4', 7: '7/8', 8: 'Full',
};

export const TRIP_DURATION_THRESHOLDS = {
  short: 5,    // under 5 min — confirm log-or-delete (a real run is ~8–15 min;
               // anything shorter is a fat-finger or a mis-tapped start/stop)
  amber: 15,   // 15+ min — amber on trip card
  alert: 25,   // 25+ min — notification fires to management
} as const;

export const REASON_LABELS: Record<Reason, string> = {
  ROUTINE:          'Routine Transport',
  COVERAGE_ASSIST:  'Coverage Assist',
  CODE_RED:         'Code Red',
  OTHER:            'Other',
};

// A quick-start trip type pre-selects the authorization that almost always
// applies: a routine run is the VSA's own call (personal/proactive), coverage
// is management asking. Still overridable on the in-transit screen before the
// trip ends. Code Red is dispatched as a management decision.
export const DEFAULT_AUTH: Partial<Record<Reason, Authorization>> = {
  ROUTINE:         'PERSONAL',
  COVERAGE_ASSIST: 'MANAGEMENT',
  CODE_RED:        'MANAGEMENT',
};

// Queue severity order, for comparing the departure snapshot against the return
// one. A run that left a manageable queue and came back to a backlog is the
// signal worth surfacing — the operational cost of pulling cleaning coverage.
export const QUEUE_RANK: Record<QueueSnapshot, number> = { '0': 0, '~5': 1, '10+': 2 };

/** True when the washbay queue got worse while the VSA was away on the run. */
export function queueWorsened(departure: QueueSnapshot | null, arrival: QueueSnapshot | null): boolean {
  if (!departure || !arrival) return false;
  return QUEUE_RANK[arrival] > QUEUE_RANK[departure];
}

// ── Pure helpers ───────────────────────────────────────────────────────────────

export function fuelColor(v: number): string {
  if (v <= 1) return '#ef4444';
  if (v <= 2) return '#f97316';
  if (v <= 3) return '#eab308';
  return '#22c55e';
}

export function elapsedSince(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const m  = Math.floor(ms / 60000);
  const s  = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Normalise a recovered queue_at_departure value back to a QueueSnapshot. The
 * column has held both a bare string ('~5') and a legacy object ({ label }), and
 * uses 'TOO_MUCH' for what the UI shows as '10+'. The 'Resumed' sentinel and any
 * null map to no reading. Pulled out of TripStartForm's recovery path so it's
 * testable and the component stays under the line cap.
 */
export function parseRecoveredQueue(raw: unknown): QueueSnapshot | null {
  if (raw == null) return null;
  if (typeof raw !== 'string') {
    const label = (raw as { label?: string }).label;
    if (!label || label === 'Resumed') return null;
    return (label === 'TOO_MUCH' ? '10+' : label) as QueueSnapshot;
  }
  return (raw === 'TOO_MUCH' ? '10+' : raw) as QueueSnapshot;
}

// ── Arrival write ────────────────────────────────────────────────────────────

export interface ArrivalInput {
  oneWay:          boolean;
  authorization:   Authorization | null;
  queue:           QueueSnapshot | null;
  queueArrival:    QueueSnapshot | null;
  notes:           string;
  isTeslaRun:      boolean;
  evCableStatus:   EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
}

/**
 * The vsa_trips update payload for ending a trip. The one-way branch is the
 * whole point: a one-way trip (airport flipping — you stayed at the destination)
 * has no return, so queue_at_arrival is forced null regardless of any value the
 * field happened to hold. A round trip keeps the captured return-queue reading.
 * one_way persists the distinction since null queue_at_arrival is ambiguous
 * (it's optional on round trips too).
 */
export function buildArrivalUpdate(input: ArrivalInput, arrivedAt: string): Record<string, unknown> {
  return {
    arrive_location:    'Airport Run',
    arrive_time:        arrivedAt,
    auth_type:          input.authorization ?? null,
    queue_at_departure: input.queue ?? null,
    queue_at_arrival:   input.oneWay ? null : (input.queueArrival ?? null),
    one_way:            input.oneWay,
    notes:              input.notes.trim() || null,
    ev_cable_status:    input.isTeslaRun ? (input.evCableStatus ?? null) : null,
    ev_adapter_status:  input.isTeslaRun ? (input.evAdapterStatus ?? null) : null,
    status:             'complete',
  };
}

/** The fields a trip-start insert needs from the form — everything else is derived here. */
export interface TripStartInput {
  tripId: string;
  vehiclePlate: string;
  isShuttle: boolean;
  driverId: string;
  branchId: string | null;
  auth: Authorization | null;
  reason: Reason;
  queue: QueueSnapshot | null;
  notes: string;
  isTeslaRun: boolean;
  evCableStatus: EvAssetStatus | null;
  evAdapterStatus: EvAssetStatus | null;
}

/**
 * Build the vsa_trips insert for a VSA starting an airport run — the departure sibling of
 * buildArrivalUpdate. Pure (takes `now`), so the plate normalization, the shuttle→trip_type
 * mapping, and the "EV fields only on a Tesla run" rule are testable without the form.
 */
export function buildTripStartInsert(input: TripStartInput, now: string): Record<string, unknown> {
  return {
    id:                  input.tripId,
    vehicle_plate:       input.vehiclePlate.trim().toUpperCase() || null,
    vehicle_unit:        '',
    trip_type:           input.isShuttle ? 'transfer' : 'clean',
    depart_location:     'Airport Run',
    arrive_location:     null,
    depart_time:         now,
    arrive_time:         null,
    driver_id:           input.driverId,
    branch_id:           input.branchId,
    is_vsa_interruption: true,
    is_shuttle:          input.isShuttle,
    auth_type:           input.auth,
    reason:              input.reason,
    queue_at_departure:  input.queue,
    notes:               input.notes.trim() || null,
    ev_cable_status:     input.isTeslaRun ? (input.evCableStatus ?? null) : null,
    ev_adapter_status:   input.isTeslaRun ? (input.evAdapterStatus ?? null) : null,
    status:              'in_progress',
  };
}
