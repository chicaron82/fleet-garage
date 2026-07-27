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
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { businessDateOf } from '../lib/shiftDay';
import { buildFlipReport, mergeFlipRows, normalizeFlipRow, sameFlipRows, type FlipRow } from '../lib/airportFlip';
import { loadServerFlips, saveServerFlips } from '../lib/airportFlipSync';

const KEY = 'fg_airport_flip';

interface Stored { day: string; rows: FlipRow[]; at: number }

// TWO caches, deliberately. `all` is the persisted truth and includes tombstones (a delete has to
// travel to the other device, so it can't just be spliced); `visible` is what every consumer sees.
// Splitting them keeps snapshot()'s stable-reference contract — filtering per call would hand
// useSyncExternalStore a fresh array each time and spin forever.
let cacheAll: FlipRow[] | null = null;
let cacheVisible: FlipRow[] = [];
let cacheDay = '';
let hydrating = false;     // one pull at a time — the 4 consumers all mount this hook
const listeners = new Set<() => void>();

/** null = nothing stored here; a stale shift-day reads as expired ({ rows: [] }, as designed). */
function parse(raw: string | null, today: string): { rows: FlipRow[]; at: number } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Stored;
    if (parsed.day !== today) return { rows: [], at: 0 };
    return { rows: (parsed.rows ?? []).map(normalizeFlipRow), at: parsed.at ?? 0 }; // heal older shapes
  } catch { return { rows: [], at: 0 }; }
}

function readStorage(today: string): { rows: FlipRow[]; at: number } {
  try {
    const fromLocal = parse(localStorage.getItem(KEY), today);
    if (fromLocal !== null) return fromLocal;
    // One-time migration: a shift already in progress when this ships still has its rows in the
    // old sessionStorage slot. Adopt them rather than dropping a live list on deploy.
    return parse(sessionStorage.getItem(KEY), today) ?? { rows: [], at: 0 };
  } catch { return { rows: [], at: 0 }; }
}

/** Every row incl. tombstones — the persisted set, and what the mutators fold over. */
function snapshotAll(today: string): FlipRow[] {
  if (cacheAll === null || cacheDay !== today) {
    setCache(today, readStorage(today).rows);
  }
  return cacheAll!;
}

/** The shared snapshot consumers render. Returns a STABLE reference between writes —
 *  useSyncExternalStore re-renders on identity change, so a fresh array each call would loop
 *  forever. Tombstones are filtered here, once per write, not per call. */
function snapshot(today: string): FlipRow[] {
  snapshotAll(today);
  return cacheVisible;
}

function setCache(today: string, all: FlipRow[]): void {
  cacheAll = all;
  cacheVisible = all.filter(r => !r.deleted);
  cacheDay = today;
}

function persist(today: string, all: FlipRow[], at: number): void {
  try { localStorage.setItem(KEY, JSON.stringify({ day: today, rows: all, at } satisfies Stored)); }
  catch { /* quota / private mode: the in-memory store still serves this session */ }
}

function commit(today: string, next: FlipRow[]): void {
  const at = Date.now();
  setCache(today, next);
  persist(today, next, at);
  void saveServerFlips(today, next, at);   // best-effort cross-device push; localStorage is the offline cache
  listeners.forEach(l => l());
}

// Cross-device pull. MERGES rather than adopting: rows reconcile individually by their own `at`,
// so a row neither device touched survives and two devices adding different cars never conflict
// (see mergeFlipRows for the loss this replaced). Pushes the reconciliation back so both sides
// converge — and because merging is idempotent, a no-op merge writes nothing and two devices
// can't ping-pong. Safe to re-run, which is what lets the refocus pull below exist at all.
async function hydrateFromServer(today: string): Promise<void> {
  if (hydrating) return;
  hydrating = true;
  try {
    const server = await loadServerFlips();
    if (!server || server.day !== today) return;  // no row / offline / stale server day → keep local
    const local = snapshotAll(today);
    const merged = mergeFlipRows(local, server.rows);
    if (sameFlipRows(merged, local)) return;      // nothing new either way → don't write
    commit(today, merged);
  } finally {
    hydrating = false;
  }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

/** Test seam — drop the module cache so a test starts from storage. */
export function __resetAirportFlipStore(): void {
  cacheAll = null;
  cacheVisible = [];
  cacheDay = '';
  hydrating = false;
}

export interface AirportFlip {
  rows: FlipRow[];
  /** `at` and `deleted` are stamped by the store, not supplied — the caller describes the CAR. */
  add: (row: Omit<FlipRow, 'id' | 'checked' | 'sent' | 'at' | 'deleted'>) => void;
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

  // Pull on mount AND whenever the app comes back to the foreground. The refocus pull is the half
  // that actually closes the loss window: he flips on the phone, adds one on the computer, then
  // picks the phone back up — the PWA was never killed, so without this it would still be holding
  // (and about to push) a list that predates the computer's flip. Safe to re-run because the merge
  // is idempotent.
  useEffect(() => {
    void hydrateFromServer(today);
    const onVisible = () => { if (document.visibilityState === 'visible') void hydrateFromServer(today); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [today]);

  // Every mutator reads the CURRENT shared snapshot rather than a captured copy, so two mounted
  // consumers can never write over each other with stale rows.
  // Folds over ALL rows (tombstones included) — a delete has to persist to reach the other
  // device. Every mutator stamps the row's own `at`: that stamp IS the merge key.
  const mutate = useCallback((fn: (prev: FlipRow[]) => FlipRow[]) => {
    commit(today, fn(snapshotAll(today)));
  }, [today]);

  const add = useCallback((row: Omit<FlipRow, 'id' | 'checked' | 'sent' | 'at' | 'deleted'>) => {
    mutate(prev => [...prev, { ...row, id: crypto.randomUUID(), checked: true, sent: false, at: Date.now(), deleted: false }]);
  }, [mutate]);

  const update = useCallback((id: string, patch: Partial<Pick<FlipRow, 'odo' | 'fuel' | 'damaged' | 'notes'>>) => {
    mutate(prev => prev.map(r => (r.id === id ? { ...r, ...patch, at: Date.now() } : r)));
  }, [mutate]);

  // Tombstone, not a splice: a spliced row would be resurrected by the other device's stale copy
  // on the next merge. Filtered from view immediately; dies with the shift day.
  const remove = useCallback((id: string) =>
    mutate(prev => prev.map(r => (r.id === id ? { ...r, deleted: true, at: Date.now() } : r))), [mutate]);

  // Only UNSENT rows toggle — a sent row is locked (nothing double-sends).
  const toggleChecked = useCallback((id: string) => {
    mutate(prev => prev.map(r => (r.id === id && !r.sent ? { ...r, checked: !r.checked, at: Date.now() } : r)));
  }, [mutate]);

  const reportForSend = useCallback(() => buildFlipReport(rows.filter(r => r.checked && !r.sent)), [rows]);

  const markSent = useCallback(() => {
    mutate(prev => prev.map(r => (r.checked && !r.sent ? { ...r, sent: true, checked: false, at: Date.now() } : r)));
  }, [mutate]);

  const checkedUnsentCount = rows.filter(r => r.checked && !r.sent).length;

  return { rows, add, update, remove, toggleChecked, reportForSend, markSent, checkedUnsentCount };
}
