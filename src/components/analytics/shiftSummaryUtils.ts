// Shared types and pure-function utilities for ShiftSummarySection.
// Kept in a separate .ts file so AnalyticsComponents.tsx can satisfy
// the fast-refresh constraint (components-only exports).

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
  };
}

export function fmtDateShift(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface OffStandardDecomposition {
  /** All off-standard minutes for the day — always equals nonAirport + airport. */
  total: number;
  /** Manually-logged off-standard (opening duties, fleeting, EDV, CSR rescue, …). */
  nonAirport: number;
  /** Auto-logged VSA airport-run minutes (the `auto_from_trip` rows). */
  airport: number;
  /** Reason → minutes for the non-airport entries only — drives the chips. */
  breakdown: Record<string, number>;
}

/**
 * Split the day's off-standard entries into airport (auto-logged from VSA trips,
 * `autoFromTrip`) and non-airport (everything manually logged). The two parts are
 * disjoint and sum to the total, so the My-Shift card can show airport time in
 * exactly one row instead of double-counting it against the separately-sourced
 * trip minutes. Trip *count* still comes from `vsa_trips`; the *minutes* shown
 * come from here so the two rows can't drift out of summing to the total.
 */
export function decomposeOffStandard(
  entries: { minutes: number | null; reason: string; autoFromTrip: boolean }[],
): OffStandardDecomposition {
  let total = 0;
  let nonAirport = 0;
  let airport = 0;
  const breakdown: Record<string, number> = {};
  for (const e of entries) {
    const m = e.minutes ?? 0;
    total += m;
    if (e.autoFromTrip) {
      airport += m;
    } else {
      nonAirport += m;
      breakdown[e.reason] = (breakdown[e.reason] ?? 0) + m;
    }
  }
  return { total, nonAirport, airport, breakdown };
}
