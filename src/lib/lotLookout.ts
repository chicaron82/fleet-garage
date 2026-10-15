// Lot Lookout — the airport stall board's rules, pure. (Ticket: docs/ticket-lot-lookout-live-airport-stall-board.md.)
//
// ⭐ WHY IT EXISTS. Aaron, 2026-10-11: *"on the clean side can tap what stalls are open so i would know if the
// airport is genuinely low on vehicles."* On 10-13 and 10-14 the bay was pulled off cleaning because "the
// airport has no cleans" while the clean side was full. A driver taps each stall open / clean / dirty; FG and the
// /lot page read the same board live.
//
// ⚠️⚠️ THE BOARD DRIFTS ONE WAY (Zee, council 2026-10-11). A customer taking a clean car, or returning one into a
// clean stall, leaves the stall still marked clean. So every count that answers "is the airport low?" uses only
// FRESH taps (`STALE_MIN`), and a stale stall is drawn faded — never as full green. An untouched stall means
// "nobody looked", never "empty".
//
// Rulings from 2026-10-14, his words in the ticket: open stays uncoloured, clean green, dirty red; the N run pulses
// at 15+ dirties; the aisle pulses whenever a car is in it; a dirty in a clean stall pulses; under 20 fresh cleans
// is "low"; tapping the same colour again undoes your tap.

export type LotState = 'open' | 'clean' | 'dirty';
export type LotRun = 'S' | 'P' | 'O' | 'N';

export interface LotStall {
  stall: string;
  run: LotRun;
  num: number;
  state: LotState | null;
  tappedBy: string | null;
  tappedAt: string | null;
}

export interface LotAisle {
  cars: number;
  tappedBy: string | null;
  tappedAt: string | null;
}

/** The usable stalls today. O1 is the cart return, N1–N2 the HIR booth (Aaron, 2026-10-14: *"O2 is an
 *  available stall. only O1 is taken up by cart return"*). Mirrors migration 151's seed. */
export const LOT_RUNS: Record<LotRun, readonly [number, number]> = { S: [1, 6], P: [1, 20], O: [2, 20], N: [3, 20] };

export const STALE_MIN = 120;
/** N holds 18. At 15 dirties it is nearly full, and the next returns land on the clean side or in the aisle. */
export const N_PULSE_AT = 15;
/** Aaron: *"use 20 as the threshold, that's essentially half the cleans side. once it drops below then we should
 *  really fill up if we can"*. Counts FRESH cleans only. */
export const CLEANS_LOW = 20;
/** Tap the same colour again within this window to undo your own tap. After it, the same colour means
 *  "looked, still true" and refreshes the stall. */
export const UNDO_MS = 5000;

export const LOT_STATES: readonly LotState[] = ['open', 'clean', 'dirty'];

export function isLotState(v: unknown): v is LotState {
  return v === 'open' || v === 'clean' || v === 'dirty';
}

/** Every usable stall id, in map order (S, P, O, N; low to high). */
export function allStallIds(): string[] {
  return (Object.keys(LOT_RUNS) as LotRun[]).flatMap(run => {
    const [lo, hi] = LOT_RUNS[run];
    return Array.from({ length: hi - lo + 1 }, (_, i) => `${run}${lo + i}`);
  });
}

export function minutesAgo(iso: string | null, nowMs: number): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((nowMs - t) / 60000));
}

/** Not tapped in `STALE_MIN` minutes, or never. */
export function isStale(s: Pick<LotStall, 'tappedAt'>, nowMs: number): boolean {
  const m = minutesAgo(s.tappedAt, nowMs);
  return m == null || m > STALE_MIN;
}

/** A dirty in a clean stall: a return the customer parked on the clean side. N is the returns run. */
export function isMisparked(s: Pick<LotStall, 'state' | 'run'>): boolean {
  return s.state === 'dirty' && s.run !== 'N';
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

export interface LotTotals {
  open: number;
  cleansSeen: number;
  dirties: number;
  misparked: number;
  nDirty: number;
  notLooked: number;
  low: boolean;
  nPulse: boolean;
  aislePulse: boolean;
  /** Minutes since anyone touched the board (a stall or the aisle); null if never. */
  lastTouchMin: number | null;
}

export function lotTotals(stalls: readonly LotStall[], aisle: LotAisle, nowMs: number): LotTotals {
  const fresh = stalls.filter(s => !isStale(s, nowMs));
  const cleansSeen = fresh.filter(s => s.state === 'clean').length;
  const nDirty = stalls.filter(s => s.run === 'N' && s.state === 'dirty').length;
  const touches = [...stalls.map(s => s.tappedAt), aisle.tappedAt]
    .map(t => minutesAgo(t, nowMs))
    .filter((m): m is number => m != null);
  return {
    open: fresh.filter(s => s.state === 'open').length,
    cleansSeen,
    dirties: stalls.filter(s => s.state === 'dirty').length,
    misparked: stalls.filter(isMisparked).length,
    nDirty,
    notLooked: stalls.filter(s => isStale(s, nowMs)).length,
    low: cleansSeen < CLEANS_LOW,
    nPulse: nDirty >= N_PULSE_AT,
    aislePulse: aisle.cars > 0,
    lastTouchMin: touches.length ? Math.min(...touches) : null,
  };
}

/** A database row → the board's shape. An unknown state reads as "nobody has looked", never as a guess. */
export function stallFromRow(r: { stall: string; run: string; num: number; state: string | null; tapped_by: string | null; tapped_at: string | null }): LotStall {
  return {
    stall: r.stall,
    run: (['S', 'P', 'O', 'N'].includes(r.run) ? r.run : 'N') as LotRun,
    num: r.num,
    state: isLotState(r.state) ? r.state : null,
    tappedBy: r.tapped_by,
    tappedAt: r.tapped_at,
  };
}

export interface LastTap {
  stall: string;
  state: LotState;
  atMs: number;
  prev: Pick<LotStall, 'state' | 'tappedBy' | 'tappedAt'>;
}

/** Is this tap an UNDO of the one just made? Same stall, same colour, inside `UNDO_MS`. */
export function isUndoTap(last: LastTap | null, stall: string, state: LotState, nowMs: number): boolean {
  return !!last && last.stall === stall && last.state === state && nowMs - last.atMs < UNDO_MS;
}
