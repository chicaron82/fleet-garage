// Shared types and pure-function utilities for ShiftSummarySection.
// Kept in a separate .ts file so AnalyticsComponents.tsx can satisfy
// the fast-refresh constraint (components-only exports).
import type { Pump2Status } from '../../lib/fuelReadings';

export function fmtMinutes(mins: number): string {
  // Round first: callers pass float-derived minutes (e.g. hours*60 = 491.99999999999994),
  // and a raw `% 60` would render "51.99999999999994m".
  const total = Math.round(mins);
  if (total === 0) return '0m';
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
}

export interface SavedSummary {
  id: string;
  userId: string;
  userName: string;
  date: string;
  savedAt: string;
  offStandardMinutes: number;
  offStandardBreakdown: Record<string, number> | null;
  tripCount: number;
  tripMinutes: number;
  holdsFlagged: number;
  firstActivityAt: string | null;
  pump2Drift: Pump2Status | null;
}

export function mapSaved(row: Record<string, unknown>): SavedSummary {
  return {
    id:                    row.id as string,
    userId:                row.user_id as string,
    userName:              row.user_name as string,
    date:                  row.date as string,
    savedAt:               row.saved_at as string,
    offStandardMinutes:    row.off_standard_minutes as number,
    offStandardBreakdown:  row.off_standard_breakdown as Record<string, number> | null,
    tripCount:             row.trip_count as number,
    tripMinutes:           row.trip_minutes as number,
    holdsFlagged:          row.holds_flagged as number,
    firstActivityAt:       row.first_activity_at as string | null,
    pump2Drift:            (row.pump2_drift as Pump2Status | null) ?? null,
  };
}

export function fmtDateShift(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface OffStandardDecomposition {
  /** All off-standard minutes for the day — always equals nonAirport + airport + flipping. */
  total: number;
  /** Manually-logged off-standard (opening duties, fleeting, EDV, CSR rescue, …). */
  nonAirport: number;
  /** Auto-logged VSA airport-run minutes (the `auto_from_trip` rows). */
  airport: number;
  /**
   * Manually-tapped "Flipping Returns" (`airport_flip`) minutes — airport work, so
   * it's not rate-affecting (`reducesDenominator` excludes it), but it isn't a VSA
   * trip either, so it gets its own line rather than inflating the trip row.
   */
  flipping: number;
  /** Reason → minutes for the non-airport entries only — drives the chips. */
  breakdown: Record<string, number>;
}

/**
 * Split the day's off-standard entries into three disjoint buckets that sum to the
 * total: airport (auto-logged from VSA trips, `autoFromTrip`), flipping (the manual
 * `airport_flip` quick-tap — airport work, but not a trip), and non-airport
 * (everything else, manually logged). Keeping them disjoint lets the My-Shift card
 * show each in exactly one row without double-counting: trip *count* still comes
 * from `vsa_trips`, the trip *minutes* come from here, and a manual flip lands on
 * its own labelled line instead of getting lumped into the rate-affecting pool.
 */
export function decomposeOffStandard(
  entries: { minutes: number | null; reason: string; autoFromTrip: boolean; presetReason?: string | null }[],
): OffStandardDecomposition {
  let total = 0;
  let nonAirport = 0;
  let airport = 0;
  let flipping = 0;
  const breakdown: Record<string, number> = {};
  for (const e of entries) {
    const m = e.minutes ?? 0;
    total += m;
    if (e.autoFromTrip) {
      airport += m;
    } else if (e.presetReason === 'airport_flip') {
      flipping += m;
    } else {
      nonAirport += m;
      breakdown[e.reason] = (breakdown[e.reason] ?? 0) + m;
    }
  }
  return { total, nonAirport, airport, flipping, breakdown };
}
