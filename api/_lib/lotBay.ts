// Lot Lookout, Erin St: what one count tap does to the lot_bay row, pure, so api/lot.ts stays a thin writer and the
// rules are tested without a database. (Ticket: docs/ticket-erin-st-cleans-ready-count.md; migration 153.)
//
// His rulings, 2026-10-15: −1 means a clean was USED (*"Erin St and the Regent location can poach cleans"*), so it
// adds to today's `used`. One exception: a −1 within 5 s of this phone's own +1 is a slip being fixed, not a car
// leaving, so it does not count as used.

export interface BayRow {
  cleans: number;
  dirties: number | null;
  used: number;
  used_on: string | null;
}

export type BayTapKind = 'ready' | 'used' | 'fix' | 'dirties';

export type BayRequest =
  | { action: 'cleans'; delta: 1 | -1; fix: boolean; by: string }
  | { action: 'dirties'; count: number; by: string };

export interface BayChange {
  patch: Record<string, string | number | null>;
  tap: { kind: BayTapKind; value: number; prev: number | null; tapped_by: string };
}

/** `today` is the shift-day (YYYY-MM-DD, 04:00 Winnipeg cutover) the tap lands in. */
export function bayChange(row: BayRow, req: BayRequest, nowIso: string, today: string): BayChange | { error: string } {
  if (req.action === 'dirties') {
    return {
      patch: { dirties: req.count, dirties_by: req.by, dirties_at: nowIso },
      tap: { kind: 'dirties', value: req.count, prev: row.dirties, tapped_by: req.by },
    };
  }
  if (req.delta === -1 && row.cleans === 0) return { error: 'Already at 0 cleans.' };
  const cleans = row.cleans + req.delta;
  const patch: BayChange['patch'] = { cleans, cleans_by: req.by, cleans_at: nowIso };
  let kind: BayTapKind = 'ready';
  if (req.delta === -1) {
    kind = req.fix ? 'fix' : 'used';
    if (!req.fix) {
      patch.used = (row.used_on === today ? row.used : 0) + 1;
      patch.used_on = today;
    }
  }
  return { patch, tap: { kind, value: cleans, prev: row.cleans, tapped_by: req.by } };
}
