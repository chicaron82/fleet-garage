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
