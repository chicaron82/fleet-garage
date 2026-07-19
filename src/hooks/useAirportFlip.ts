// The airport-flip session (see lib/airportFlip). ONE shared store behind every consumer,
// persisted to localStorage and stamped with the SHIFT DAY so it still self-clears on a new
// shift — a stale-day payload is dropped on read. No table, no migration.
//
// WHY localStorage and not sessionStorage (fixed 2026-07-19, found live): the "dies with the
// shift" guardrail was originally implemented as sessionStorage. But sessionStorage doesn't die
// with the SHIFT, it dies with the PROCESS — and FG runs as a phone PWA all day. Android reclaims
// memory from backgrounded apps (Aaron at 22% battery, heavy foreground use, phone lighting up all
// shift), FG gets killed, and the list silently starts over: he'd recorded ~7 flips and the card
// showed 2. The shift expiry never came from the storage type — it comes from the `day` stamp
// written alongside the rows, which is untouched here. localStorage keeps that guarantee and
// survives the app being killed.
//
// WHY one store and not per-hook state: four components call this (My Shift's section, the two
// analytics cards, the washbay handoff). Each previously held its OWN copy seeded at mount and
// wrote the whole payload back to one key — N independent writers over one slot, a clobber waiting
// for the right interleaving. useSyncExternalStore gives every consumer one snapshot and one
// writer path.
import { useCallback, useSyncExternalStore } from 'react';
import { businessDateOf } from '../lib/shiftDay';
import { buildFlipReport, normalizeFlipRow, type FlipRow } from '../lib/airportFlip';

const KEY = 'fg_airport_flip';

interface Stored { day: string; rows: FlipRow[] }

let cache: FlipRow[] | null = null;
let cacheDay = '';
const listeners = new Set<() => void>();

/** null = nothing stored here; [] = stored but a stale shift-day (expired, as designed). */
function parse(raw: string | null, today: string): FlipRow[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.day !== today) return [];
    return (parsed.rows ?? []).map(normalizeFlipRow); // heal older shapes
  } catch { return []; }
}

function readStorage(today: string): FlipRow[] {
  try {
    const fromLocal = parse(localStorage.getItem(KEY), today);
    if (fromLocal !== null) return fromLocal;
    // One-time migration: a shift already in progress when this ships still has its rows in the
    // old sessionStorage slot. Adopt them rather than dropping a live list on deploy.
    return parse(sessionStorage.getItem(KEY), today) ?? [];
  } catch { return []; }
}

/** The shared snapshot. Returns a STABLE reference between writes — useSyncExternalStore
 *  re-renders on identity change, so a fresh array each call would loop forever. */
function snapshot(today: string): FlipRow[] {
  if (cache === null || cacheDay !== today) {
    cache = readStorage(today);
    cacheDay = today;
  }
  return cache;
}

function commit(today: string, next: FlipRow[]): void {
  cache = next;
  cacheDay = today;
  try { localStorage.setItem(KEY, JSON.stringify({ day: today, rows: next } satisfies Stored)); }
  catch { /* quota / private mode: the in-memory store still serves this session */ }
  listeners.forEach(l => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Test seam — drop the module cache so a test starts from storage. */
export function __resetAirportFlipStore(): void {
  cache = null;
  cacheDay = '';
}

export interface AirportFlip {
  rows: FlipRow[];
  add: (row: Omit<FlipRow, 'id' | 'checked' | 'sent'>) => void;
  update: (id: string, patch: Partial<Pick<FlipRow, 'odo' | 'fuel' | 'damaged' | 'notes'>>) => void;
  remove: (id: string) => void;
  toggleChecked: (id: string) => void;
  /** The text for the checked-and-unsent rows, or '' if none — the caller copies + calls markSent. */
  reportForSend: () => string;
  /** Mark every checked-and-unsent row as sent (and clear its check) — called after a successful copy. */
  markSent: () => void;
  checkedUnsentCount: number;
}

export function useAirportFlip(): AirportFlip {
  const today = businessDateOf(new Date());
  const getSnapshot = useCallback(() => snapshot(today), [today]);
  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // Every mutator reads the CURRENT shared snapshot rather than a captured copy, so two mounted
  // consumers can never write over each other with stale rows.
  const mutate = useCallback((fn: (prev: FlipRow[]) => FlipRow[]) => {
    commit(today, fn(snapshot(today)));
  }, [today]);

  const add = useCallback((row: Omit<FlipRow, 'id' | 'checked' | 'sent'>) => {
    mutate(prev => [...prev, { ...row, id: crypto.randomUUID(), checked: true, sent: false }]);
  }, [mutate]);

  const update = useCallback((id: string, patch: Partial<Pick<FlipRow, 'odo' | 'fuel' | 'damaged' | 'notes'>>) => {
    mutate(prev => prev.map(r => (r.id === id ? { ...r, ...patch } : r)));
  }, [mutate]);

  const remove = useCallback((id: string) => mutate(prev => prev.filter(r => r.id !== id)), [mutate]);

  // Only UNSENT rows toggle — a sent row is locked (nothing double-sends).
  const toggleChecked = useCallback((id: string) => {
    mutate(prev => prev.map(r => (r.id === id && !r.sent ? { ...r, checked: !r.checked } : r)));
  }, [mutate]);

  const reportForSend = useCallback(() => buildFlipReport(rows.filter(r => r.checked && !r.sent)), [rows]);

  const markSent = useCallback(() => {
    mutate(prev => prev.map(r => (r.checked && !r.sent ? { ...r, sent: true, checked: false } : r)));
  }, [mutate]);

  const checkedUnsentCount = rows.filter(r => r.checked && !r.sent).length;

  return { rows, add, update, remove, toggleChecked, reportForSend, markSent, checkedUnsentCount };
}
