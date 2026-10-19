// Lot Lookout's /lot pages and FG's offline copy (the service worker's precache): ONLY when the driver asks for it.
// (docs/ticket-lot-offline-copy-is-opt-in.md)
//
// ⭐ Aaron, 2026-10-18, on FG's ~6 MB copy landing on any phone that opened /lot: *"its small though some may not want
// to use their data. perhaps a disclaimer with the link? an explicit opt in?"* → the opt-in. A phone with no copy
// registers nothing (and, loading fresh every time, can never go stale); the airport page offers the copy in one line.
// A phone that already has one (FG installed, or opted in before) keeps the "new version · Reload" prompt.

export const LOT_OFFLINE_KEY = 'lot_offline';

/** What the copy costs, said where it is offered. Measured 2026-10-18 (dist/sw.js precache: 96 files, 6.1 MB);
 *  re-measure if the bundle grows a lot. */
export const LOT_OFFLINE_SIZE = 'about 6 MB';

/** 'saved' = a copy already controls this page; 'saving' = he asked this visit, it downloads in the background;
 *  'offer' = no copy and never asked: nothing is downloaded until he taps. */
export type LotOfflineState = 'saved' | 'saving' | 'offer';

export function lotOfflineState(hasCopy: boolean, optedIn: boolean): LotOfflineState {
  return hasCopy ? 'saved' : optedIn ? 'saving' : 'offer';
}

/** Register the worker (and so download the copy) only when one is already here or he asked for it. */
export const registersWorker = (s: LotOfflineState): boolean => s !== 'offer';
