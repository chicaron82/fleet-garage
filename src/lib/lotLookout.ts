// Lot Lookout — the shared, pure bits every Lot Lookout page uses: which page a path opens, ages, initials.
//
// ⭐ The airport STALL BOARD that this file was written for (2026-10-11 → 10-17: 63 stalls, three swatches each,
// hold-for-taken, the 2-hour fade, the misparked "!") was retired on 2026-10-18 for his two-reading design: *"notches
// are fine, scrap the stale time and stall map"*. The airport's rules live in lotAirport.ts (migration 157); the old
// tables (lot_stalls, lot_aisle, lot_taps) stay as history. Git holds the board's code (before migration 157).

/** Which Lot Lookout page a path opens, or null for FG itself. /lot is the airport readings, /lot/erin Erin St's count
 *  (migration 153), /lot/view both, read only. A trailing slash is the same page. */
export type LotPageKind = 'airport' | 'erin' | 'view';
export function lotPageOf(pathname: string): LotPageKind | null {
  const p = pathname.replace(/\/+$/, '').toLowerCase();
  return p === '/lot' ? 'airport' : p === '/lot/erin' ? 'erin' : p === '/lot/view' ? 'view' : null;
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
