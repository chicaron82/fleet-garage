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
