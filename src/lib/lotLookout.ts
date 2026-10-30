// Lot Lookout — the shared, pure bits every Lot Lookout page uses: which page a path opens, ages, initials.
//
// ⭐ The airport STALL BOARD that this file was written for (2026-10-11 → 10-17: 63 stalls, three swatches each,
// hold-for-taken, the 2-hour fade, the misparked "!") was retired on 2026-10-18 for his two-reading design: *"notches
// are fine, scrap the stale time and stall map"*. The readings (migration 157) went too, on 2026-10-29: *"airport lot
// data is hard to keep track of"*. Their tables (lot_stalls, lot_aisle, lot_taps, lot_airport, lot_airport_taps) stay as
// history; git holds the code. Lot Lookout is Erin St now: the count and the bay log (161).

/** Which Lot Lookout page a path opens, or null for FG itself. /lot/erin is Erin St's count (migration 153), /lot/view
 *  the read-only bay. ⭐ /lot was the drivers' airport page until 2026-10-29 (*"cutting it altogether and focusing on
 *  erin st"*); it opens the read-only view now, so a link already saved on a driver's phone is never a dead page.
 *  A trailing slash is the same page. */
export type LotPageKind = 'erin' | 'view';
export function lotPageOf(pathname: string): LotPageKind | null {
  const p = pathname.replace(/\/+$/, '').toLowerCase();
  return p === '/lot' || p === '/lot/view' ? 'view' : p === '/lot/erin' ? 'erin' : null;
}

/** A quick tap can be taken back within this window (Erin St's count: a −1 right after your own +1 is a slip). */
export const UNDO_MS = 5000;

export function minutesAgo(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 60000));
}

export function agoLabel(min: number | null): string {
  if (min == null) return 'never';
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

export function shortAgo(min: number | null): string {
  if (min == null) return '';
  if (min < 1) return 'now';
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h`;
}

/** "Larry J" → "LJ"; "krish" → "K"; "HIR" stays "HIR". */
export function initialsOf(name: string | null): string {
  const n = (name ?? '').trim();
  if (!n) return '';
  if (/^[A-Z]{2,3}$/.test(n)) return n;
  return n.split(/\s+/).map(w => w[0]).join('').slice(0, 3).toUpperCase();
}
