// Lot Lookout, Erin St: what one count tap does to the lot_bay row, pure, so api/lot.ts stays a thin writer and the
// rules are tested without a database. (Ticket: docs/ticket-erin-st-cleans-ready-count.md; migration 153.)
//
// His rulings, 2026-10-15: −1 means a clean was USED (*"Erin St and the Regent location can poach cleans"*), so it
// adds to today's `used`. One exception: a −1 within 5 s of this phone's own +1 is a slip being fixed, not a car
// leaving, so it does not count as used.
//
// ⭐ The quick taps (2026-10-16, migration 156; docs/ticket-lot-lookout-too-slow-on-the-fly.md). His notes after a real
// shift: *"it's too complex to use fast and on the fly"*, then his own layout for the Erin pill's sheet:
//   • SET (cleans): typed to what's on the lot. A correction (*"catching up the cleans to what was on the lot"*), so
//     never counted as used.
//   • DRAIN: minus the drivers on now (*"tap the drain and removes 3 cleans off the count"*). Those cars went up, so
//     they ARE used. It stops at 0 and says how many it really took.
//   • FILL: plus the same drivers' dirties (*"the same 3 drivers arrive back at the bay with dirties"*).
//   • ±1 on dirties, like the cleans. Zero is a SET to 0, on either.
//   • UNDO: a quick tap put back from its 5-second Undo; the row returns to what the phone saw before it.
//
// ⭐ A clean +1 takes a dirty (Aaron, 2026-10-21: *"I finish cleaning 1 so that means 1 less dirty on the board"*;
// docs/ticket-erin-clean-plus-takes-a-dirty.md). One car changes pools, so one save moves both. Dirties at 0 stay 0 (a
// car cleaned before anyone counted it dirty). The slip fix gives the dirty back only when the phone says its +1
// took one (`giveDirty`), so a fix never invents a dirty. A real −1 (a clean used) never touches dirties.

export interface BayRow {
  cleans: number;
  dirties: number | null;
  used: number;
  used_on: string | null;
}

export type BayTapKind = 'ready' | 'used' | 'fix' | 'dirties' | 'set' | 'drain' | 'fill' | 'undo';

/** What a quick tap's Undo puts back: the row as the phone saw it before the tap. */
export interface BaySnapshot { cleans: number; dirties: number | null; used: number; usedOn: string | null }

export type BayRequest =
  | { action: 'cleans'; delta: 1 | -1; fix: boolean; giveDirty?: boolean; by: string }
  | { action: 'dirties'; count: number; by: string }
  | { action: 'cleansSet'; count: number; by: string }
  | { action: 'drain'; n: number; by: string }
  | { action: 'dirtiesStep'; delta: 1 | -1; by: string }
  | { action: 'fill'; n: number; by: string }
  | { action: 'bayUndo'; field: 'cleans' | 'dirties'; to: BaySnapshot; by: string };

export const BAY_ACTIONS: readonly BayRequest['action'][] = ['cleans', 'dirties', 'cleansSet', 'drain', 'dirtiesStep', 'fill', 'bayUndo'];

/** A typed count at Erin St, either one. A cap, so a fat-fingered 2300 is refused rather than shown. */
export const COUNT_MAX = 300;

export interface BayChange {
  patch: Record<string, string | number | null>;
  tap: { kind: BayTapKind; value: number; prev: number | null; tapped_by: string };
}

const usedSoFar = (row: BayRow, today: string) => (row.used_on === today ? row.used : 0);

/** `today` is the shift-day (YYYY-MM-DD, 04:00 Winnipeg cutover) the tap lands in. */
export function bayChange(row: BayRow, req: BayRequest, nowIso: string, today: string): BayChange | { error: string } {
  const cleansStamp = { cleans_by: req.by, cleans_at: nowIso };
  const dirtiesStamp = { dirties_by: req.by, dirties_at: nowIso };
  const tap = (kind: BayTapKind, value: number, prev: number | null) => ({ kind, value, prev, tapped_by: req.by });

  switch (req.action) {
    case 'dirties':
      return { patch: { dirties: req.count, ...dirtiesStamp }, tap: tap('dirties', req.count, row.dirties) };
    case 'dirtiesStep': {
      const before = row.dirties ?? 0;
      if (req.delta === -1 && before === 0) return { error: 'Already at 0 dirties.' };
      const dirties = Math.min(COUNT_MAX, before + req.delta);
      return { patch: { dirties, ...dirtiesStamp }, tap: tap('dirties', dirties, row.dirties) };
    }
    case 'fill': {
      const dirties = Math.min(COUNT_MAX, (row.dirties ?? 0) + req.n);
      return { patch: { dirties, ...dirtiesStamp }, tap: tap('fill', dirties, row.dirties) };
    }
    case 'cleansSet':
      return { patch: { cleans: req.count, ...cleansStamp }, tap: tap('set', req.count, row.cleans) };
    case 'drain': {
      if (row.cleans === 0) return { error: 'No cleans to send up.' };
      const took = Math.min(req.n, row.cleans);
      const cleans = row.cleans - took;
      return {
        patch: { cleans, ...cleansStamp, used: usedSoFar(row, today) + took, used_on: today },
        tap: tap('drain', cleans, row.cleans),
      };
    }
    case 'bayUndo': {
      const t = req.to;
      return {
        patch: {
          cleans: t.cleans, dirties: t.dirties, used: t.used, used_on: t.usedOn,
          ...(req.field === 'cleans' ? cleansStamp : dirtiesStamp),
        },
        tap: tap('undo', (req.field === 'cleans' ? t.cleans : t.dirties) ?? 0, req.field === 'cleans' ? row.cleans : row.dirties),
      };
    }
    case 'cleans': {
      if (req.delta === -1 && row.cleans === 0) return { error: 'Already at 0 cleans.' };
      const cleans = row.cleans + req.delta;
      const patch: BayChange['patch'] = { cleans, ...cleansStamp };
      let kind: BayTapKind = 'ready';
      if (req.delta === 1 && (row.dirties ?? 0) > 0) Object.assign(patch, { dirties: row.dirties! - 1, ...dirtiesStamp });
      if (req.delta === -1) {
        kind = req.fix ? 'fix' : 'used';
        if (req.fix && req.giveDirty) Object.assign(patch, { dirties: Math.min(COUNT_MAX, (row.dirties ?? 0) + 1), ...dirtiesStamp });
        if (!req.fix) {
          patch.used = usedSoFar(row, today) + 1;
          patch.used_on = today;
        }
      }
      return { patch, tap: tap(kind, cleans, row.cleans) };
    }
  }
}
